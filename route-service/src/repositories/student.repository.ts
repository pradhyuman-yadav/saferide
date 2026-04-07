import { getDb } from '@saferide/firebase-admin';
import type { Student, UpdateStudentInput } from '@saferide/types';
import { StudentSchema } from '@saferide/types';

export class StudentRepository {
  private col() {
    return getDb().collection('students');
  }

  private doc(id: string) {
    return this.col().doc(id);
  }

  async listByTenantId(tenantId: string): Promise<Student[]> {
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => StudentSchema.parse({ ...d.data(), id: d.id }));
  }

  async findById(id: string, tenantId: string): Promise<Student | null> {
    const snap = await this.doc(id).get();
    if (!snap.exists) return null;
    const data = StudentSchema.parse({ ...snap.data(), id: snap.id });
    if (data.tenantId !== tenantId) return null;
    return data;
  }

  async listByStopIds(stopIds: string[], tenantId: string): Promise<Student[]> {
    if (stopIds.length === 0) return [];
    // Firestore 'in' supports up to 30 values; chunk if needed
    const chunkSize = 30;
    const results: Student[] = [];
    for (let i = 0; i < stopIds.length; i += chunkSize) {
      const chunk = stopIds.slice(i, i + chunkSize);
      const snap = await this.col()
        .where('tenantId', '==', tenantId)
        .where('stopId', 'in', chunk)
        .get();
      snap.docs.forEach((d) => results.push(StudentSchema.parse({ ...d.data(), id: d.id })));
    }
    return results;
  }

  /** Returns students currently assigned to the given bus. */
  async listByBusId(busId: string, tenantId: string): Promise<Student[]> {
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .where('busId', '==', busId)
      .get();
    return snap.docs.map((d) => StudentSchema.parse({ ...d.data(), id: d.id }));
  }

  async create(data: Omit<Student, 'id'>): Promise<string> {
    const ref = await this.col().add(data);
    return ref.id;
  }

  async update(
    id: string,
    tenantId: string,
    updates: UpdateStudentInput | { isActive: boolean } | { busId: string | null },
  ): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error('NOT_FOUND');
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    await this.doc(id).update({ ...patch, updatedAt: Date.now() });
  }
}
