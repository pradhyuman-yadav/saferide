import type { Student, CreateStudentInput, UpdateStudentInput } from '@saferide/types';
import { getDb } from '@saferide/firebase-admin';
import { createServiceLogger } from '@saferide/logger';
import { StudentRepository } from '../repositories/student.repository';
import { StopRepository } from '../repositories/stop.repository';
import { BusRepository }  from '../repositories/bus.repository';
import { findOrCreateFirebaseUser, sendSetupEmail } from '../utils/firebase-auth.utils';

const log = createServiceLogger('student');

const repo      = new StudentRepository();
const stopRepo  = new StopRepository();
const busRepo   = new BusRepository();

export class StudentService {
  listStudents(tenantId: string): Promise<Student[]> {
    return repo.listByTenantId(tenantId);
  }

  /** Returns the student if it exists and belongs to tenantId; null otherwise. */
  async findStudent(id: string, tenantId: string): Promise<Student | null> {
    const student = await repo.findById(id, tenantId);
    // Defense-in-depth: verify tenantId even if repo enforces it at query level
    if (student !== null && student.tenantId !== tenantId) return null;
    return student;
  }

  /** Like findStudent but throws STUDENT_NOT_FOUND instead of returning null. */
  async getStudent(id: string, tenantId: string): Promise<Student> {
    const student = await this.findStudent(id, tenantId);
    if (student === null) {
      log.warn({ studentId: id, tenantId }, 'student not found');
      throw new Error('STUDENT_NOT_FOUND');
    }
    return student;
  }

  async createStudent(input: CreateStudentInput, tenantId: string): Promise<Student> {
    // Resolve parent's Firebase UID server-side from their email
    const parentFirebaseUid = await findOrCreateFirebaseUser(input.parentEmail, input.parentName);

    const now = Date.now();
    const studentId = await repo.create({
      tenantId,
      name:              input.name,
      parentFirebaseUid,
      parentName:        input.parentName,
      parentPhone:       input.parentPhone,
      parentEmail:       input.parentEmail,
      busId:             input.busId ?? null,
      stopId:            input.stopId ?? null,
      isActive:          true,
      createdAt:         now,
      updatedAt:         now,
    });

    // Send setup email so the parent can set their password and sign in to the app
    await sendSetupEmail(input.parentEmail);

    // Write pending invite so the mobile app can auto-claim the parent's profile
    // on first sign-in (claimPendingInviteByEmail in auth.store.ts checks this).
    const inviteKey = input.parentEmail.replace(/[@.]/g, '_');
    await getDb().collection('pendingInvites').doc(inviteKey).set({
      role:      'parent',
      tenantId,
      status:    'pending',
      createdAt: now,
      updatedAt: now,
    });

    const created = await repo.findById(studentId, tenantId);
    if (created === null) throw new Error('Failed to retrieve created student');
    log.info({ studentId: created.id, tenantId, parentEmail: created.parentEmail }, 'student created; parent invite written');
    return created;
  }

  /**
   * Updates a student's fields.
   * Business rule: busId is ALWAYS derived from the stop assignment.
   *   - If stopId is being set to a stop → busId is auto-set to the bus serving that stop's route.
   *   - If stopId is being cleared → busId is also cleared.
   *   - Any busId in the input payload is silently ignored.
   */
  async updateStudent(id: string, input: UpdateStudentInput, tenantId: string): Promise<Student> {
    const existing = await this.findStudent(id, tenantId);
    if (existing === null) throw new Error('STUDENT_NOT_FOUND');

    // Strip any busId from the payload — it is always derived, never set directly
    const { busId: _ignored, ...safeInput } = input as UpdateStudentInput & { busId?: unknown };

    let derivedBusId: string | null | undefined; // undefined = do not touch busId

    if ('stopId' in safeInput && safeInput.stopId !== undefined) {
      if (safeInput.stopId === null) {
        // Removing stop → also clear bus
        derivedBusId = null;
      } else {
        // Assigning to a stop → look up the route → look up the bus
        const stop = await stopRepo.findById(safeInput.stopId, tenantId);
        if (stop === null) throw new Error('STOP_NOT_FOUND');
        const bus = await busRepo.findByRouteId(stop.routeId, tenantId);
        derivedBusId = bus?.id ?? null;
      }
    }

    const patch: Record<string, unknown> = { ...safeInput };
    if (derivedBusId !== undefined) patch['busId'] = derivedBusId;

    await repo.update(id, tenantId, patch as Parameters<typeof repo.update>[2]);

    const updated = await repo.findById(id, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated student');
    log.info(
      { studentId: id, tenantId, stopId: updated.stopId, busId: updated.busId, fields: Object.keys(safeInput) },
      'student updated',
    );
    return updated;
  }

  async deleteStudent(id: string, tenantId: string): Promise<void> {
    const existing = await this.findStudent(id, tenantId);
    if (existing === null) throw new Error('STUDENT_NOT_FOUND');
    await repo.update(id, tenantId, { isActive: false });
    log.info({ studentId: id, tenantId }, 'student soft-deleted (isActive → false)');
  }
}
