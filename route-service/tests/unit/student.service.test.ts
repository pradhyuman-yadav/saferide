import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Student, CreateStudentInput, UpdateStudentInput } from '@saferide/types';

const repoMock = vi.hoisted(() => ({
  listByTenantId: vi.fn(),
  findById:       vi.fn(),
  create:         vi.fn(),
  update:         vi.fn(),
}));

vi.mock('../../src/repositories/student.repository', () => ({
  StudentRepository: vi.fn().mockImplementation(() => repoMock),
}));

vi.mock('../../src/utils/firebase-auth.utils', () => ({
  findOrCreateFirebaseUser: vi.fn().mockResolvedValue('parent-uid-001'),
  sendSetupEmail:           vi.fn().mockResolvedValue(undefined),
}));

const mockChildLogger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue(mockChildLogger),
}));

const mockPendingInviteSet = vi.fn().mockResolvedValue(undefined);
vi.mock('@saferide/firebase-admin', () => ({
  getDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: mockPendingInviteSet,
      })),
    })),
  })),
}));

import { StudentService } from '../../src/services/student.service';

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id:                'student-001',
    tenantId:          'tenant-001',
    name:              'Arjun Sharma',
    parentFirebaseUid: 'parent-uid-001',
    parentName:        'Priya Sharma',
    parentPhone:       '9876543210',
    parentEmail:       'priya@example.com',
    busId:             null,
    stopId:            null,
    isActive:          true,
    createdAt:         1700000000000,
    updatedAt:         1700000000000,
    ...overrides,
  };
}

const validCreateInput: CreateStudentInput = {
  name:        'Arjun Sharma',
  parentName:  'Priya Sharma',
  parentPhone: '9876543210',
  parentEmail: 'priya@example.com',
};

describe('StudentService', () => {
  let service: StudentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StudentService();
  });

  // ── listStudents ──────────────────────────────────────────────────────────
  it('listStudents() returns array from repo.listByTenantId()', async () => {
    const students = [makeStudent(), makeStudent({ id: 'student-002' })];
    repoMock.listByTenantId.mockResolvedValue(students);

    const result = await service.listStudents('tenant-001');

    expect(repoMock.listByTenantId).toHaveBeenCalledWith('tenant-001');
    expect(result).toEqual(students);
  });

  // ── findStudent ───────────────────────────────────────────────────────────
  it('findStudent() returns the student when id and tenantId match', async () => {
    repoMock.findById.mockResolvedValue(makeStudent());

    const result = await service.findStudent('student-001', 'tenant-001');

    expect(result).toMatchObject({ id: 'student-001' });
  });

  it('findStudent() returns null when student does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    const result = await service.findStudent('missing', 'tenant-001');

    expect(result).toBeNull();
  });

  it('findStudent() returns null when student belongs to a different tenant (tenant isolation)', async () => {
    repoMock.findById.mockResolvedValue(makeStudent({ tenantId: 'tenant-002' }));

    const result = await service.findStudent('student-001', 'tenant-001');

    expect(result).toBeNull();
  });

  // ── getStudent ────────────────────────────────────────────────────────────
  it('getStudent() returns the student when found', async () => {
    repoMock.findById.mockResolvedValue(makeStudent());

    const result = await service.getStudent('student-001', 'tenant-001');

    expect(result).toMatchObject({ id: 'student-001' });
  });

  it('getStudent() throws STUDENT_NOT_FOUND when student does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.getStudent('missing', 'tenant-001')).rejects.toThrow('STUDENT_NOT_FOUND');
  });

  it('getStudent() throws STUDENT_NOT_FOUND when student belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeStudent({ tenantId: 'tenant-999' }));

    await expect(service.getStudent('student-001', 'tenant-001')).rejects.toThrow('STUDENT_NOT_FOUND');
  });

  // ── createStudent ─────────────────────────────────────────────────────────
  it('createStudent() calls repo.create() and returns the created student', async () => {
    const created = makeStudent();
    repoMock.create.mockResolvedValue('student-001');
    repoMock.findById.mockResolvedValue(created);

    const result = await service.createStudent(validCreateInput, 'tenant-001');

    expect(repoMock.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });

  it('createStudent() always sets isActive=true and tenantId from context', async () => {
    repoMock.create.mockResolvedValue('student-001');
    repoMock.findById.mockResolvedValue(makeStudent());

    await service.createStudent(validCreateInput, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['isActive']).toBe(true);
    expect(createCall['tenantId']).toBe('tenant-001');
  });

  it('createStudent() stores the resolved parentFirebaseUid server-side', async () => {
    repoMock.create.mockResolvedValue('student-001');
    repoMock.findById.mockResolvedValue(makeStudent());

    await service.createStudent(validCreateInput, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['parentFirebaseUid']).toBe('parent-uid-001');
  });

  it('createStudent() sets busId and stopId to null when not provided', async () => {
    repoMock.create.mockResolvedValue('student-001');
    repoMock.findById.mockResolvedValue(makeStudent());

    await service.createStudent(validCreateInput, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['busId']).toBeNull();
    expect(createCall['stopId']).toBeNull();
  });

  it('createStudent() writes a pending invite to Firestore for the parent', async () => {
    repoMock.create.mockResolvedValue('student-001');
    repoMock.findById.mockResolvedValue(makeStudent());

    await service.createStudent(validCreateInput, 'tenant-001');

    expect(mockPendingInviteSet).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'parent', tenantId: 'tenant-001', status: 'pending' }),
    );
  });

  it('createStudent() throws when repo.findById() returns null after create', async () => {
    repoMock.create.mockResolvedValue('student-001');
    repoMock.findById.mockResolvedValue(null);

    await expect(service.createStudent(validCreateInput, 'tenant-001')).rejects.toThrow();
  });

  // ── updateStudent ─────────────────────────────────────────────────────────
  it('updateStudent() calls repo.update() and returns the updated student', async () => {
    const existing = makeStudent();
    const updated  = makeStudent({ parentPhone: '9999999999' });
    repoMock.findById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    repoMock.update.mockResolvedValue(undefined);

    const input: UpdateStudentInput = { parentPhone: '9999999999' };
    const result = await service.updateStudent('student-001', input, 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('student-001', 'tenant-001', input);
    expect(result).toEqual(updated);
  });

  it('updateStudent() throws STUDENT_NOT_FOUND when student does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.updateStudent('missing', { parentPhone: '9999999999' }, 'tenant-001')).rejects.toThrow('STUDENT_NOT_FOUND');
  });

  it('updateStudent() throws STUDENT_NOT_FOUND when student belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeStudent({ tenantId: 'tenant-999' }));

    await expect(service.updateStudent('student-001', { parentPhone: '9999999999' }, 'tenant-001')).rejects.toThrow('STUDENT_NOT_FOUND');
  });

  // ── deleteStudent ─────────────────────────────────────────────────────────
  it('deleteStudent() soft-deletes by setting isActive to false', async () => {
    repoMock.findById.mockResolvedValue(makeStudent());
    repoMock.update.mockResolvedValue(undefined);

    await service.deleteStudent('student-001', 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('student-001', 'tenant-001', { isActive: false });
  });

  it('deleteStudent() throws STUDENT_NOT_FOUND when student does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.deleteStudent('missing', 'tenant-001')).rejects.toThrow('STUDENT_NOT_FOUND');
  });

  it('deleteStudent() throws STUDENT_NOT_FOUND when student belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeStudent({ tenantId: 'tenant-999' }));

    await expect(service.deleteStudent('student-001', 'tenant-001')).rejects.toThrow('STUDENT_NOT_FOUND');
  });
});
