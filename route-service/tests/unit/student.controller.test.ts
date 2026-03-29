import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Student } from '@saferide/types';

const serviceMock = vi.hoisted(() => ({
  listStudents:  vi.fn(),
  findStudent:   vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
}));

vi.mock('../../src/services/student.service', () => ({
  StudentService: vi.fn().mockImplementation(() => serviceMock),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { StudentController } from '../../src/controllers/student.controller';

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

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user:   { uid: 'user-001', role: 'school_admin', tenantId: 'tenant-001' },
    params: {},
    body:   {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  const json   = vi.fn();
  const send   = vi.fn();
  const status = vi.fn().mockReturnValue({ json, send });
  const res    = { status, json, send } as unknown as Response;
  return { res, status, json, send };
}

describe('StudentController', () => {
  let controller: StudentController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new StudentController();
  });

  // ── list ──────────────────────────────────────────────────────────────────
  it('list() returns 200 with students array', async () => {
    const students = [makeStudent()];
    serviceMock.listStudents.mockResolvedValue(students);

    const req = makeReq();
    const { res, json } = makeRes();

    await controller.list(req, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: students });
  });

  it('list() returns 403 when tenantId is null', async () => {
    const req = makeReq({ user: { uid: 'u', role: 'super_admin', tenantId: null } as never });
    const { res, status } = makeRes();

    await controller.list(req, res);

    expect(status).toHaveBeenCalledWith(403);
  });

  // ── getById ───────────────────────────────────────────────────────────────
  it('getById() returns 200 when student exists', async () => {
    serviceMock.findStudent.mockResolvedValue(makeStudent());

    const req = makeReq({ params: { id: 'student-001' } });
    const { res, json } = makeRes();

    await controller.getById(req, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ id: 'student-001' }) });
  });

  it('getById() returns 404 when student not found', async () => {
    serviceMock.findStudent.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'missing' } });
    const { res, status } = makeRes();

    await controller.getById(req, res);

    expect(status).toHaveBeenCalledWith(404);
  });

  // ── create ────────────────────────────────────────────────────────────────
  it('create() returns 201 with the new student', async () => {
    const newStudent = makeStudent();
    serviceMock.createStudent.mockResolvedValue(newStudent);

    const req = makeReq({ body: {
      name: 'Arjun Sharma', parentName: 'Priya Sharma',
      parentPhone: '9876543210', parentEmail: 'priya@example.com',
    }});
    const { res, status } = makeRes();

    await controller.create(req, res);

    expect(status).toHaveBeenCalledWith(201);
  });

  it('create() returns 403 when tenantId is null', async () => {
    const req = makeReq({ user: { uid: 'u', role: 'super_admin', tenantId: null } as never });
    const { res, status } = makeRes();

    await controller.create(req, res);

    expect(status).toHaveBeenCalledWith(403);
  });

  // ── update ────────────────────────────────────────────────────────────────
  it('update() returns 200 with the updated student', async () => {
    serviceMock.updateStudent.mockResolvedValue(makeStudent({ parentPhone: '9999999999' }));

    const req = makeReq({ params: { id: 'student-001' }, body: { parentPhone: '9999999999' } });
    const { res, json } = makeRes();

    await controller.update(req, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ parentPhone: '9999999999' }) });
  });

  it('update() returns 404 when student not found', async () => {
    serviceMock.updateStudent.mockRejectedValue(new Error('STUDENT_NOT_FOUND'));

    const req = makeReq({ params: { id: 'missing' }, body: { parentPhone: '9999999999' } });
    const { res, status } = makeRes();

    await controller.update(req, res);

    expect(status).toHaveBeenCalledWith(404);
  });

  // ── delete ────────────────────────────────────────────────────────────────
  it('delete() returns 204 on success', async () => {
    serviceMock.deleteStudent.mockResolvedValue(undefined);

    const req = makeReq({ params: { id: 'student-001' } });
    const { res, status } = makeRes();

    await controller.delete(req, res);

    expect(status).toHaveBeenCalledWith(204);
  });

  it('delete() returns 404 when student not found', async () => {
    serviceMock.deleteStudent.mockRejectedValue(new Error('STUDENT_NOT_FOUND'));

    const req = makeReq({ params: { id: 'missing' } });
    const { res, status } = makeRes();

    await controller.delete(req, res);

    expect(status).toHaveBeenCalledWith(404);
  });
});
