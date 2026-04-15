import { getDb } from '@saferide/firebase-admin';
import { StudentSchema } from '@saferide/types';
import type { Student } from '@saferide/types';

/**
 * Read-only student repository used by geofencing (listByStopId) and
 * boarding (findById).
 * Student CRUD belongs to route-service; this service only reads.
 */
export class StudentRepository {
  async listByStopId(stopId: string, tenantId: string): Promise<Student[]> {
    const snap = await getDb()
      .collection('students')
      .where('tenantId', '==', tenantId)
      .where('stopId',   '==', stopId)
      .where('isActive', '==', true)
      .get();

    return snap.docs.map((d) => StudentSchema.parse({ ...d.data(), id: d.id }));
  }

  async findById(id: string, tenantId: string): Promise<Student | null> {
    const snap = await getDb().collection('students').doc(id).get();
    if (!snap.exists) return null;
    const data = StudentSchema.parse({ ...snap.data(), id: snap.id });
    if (data.tenantId !== tenantId) return null;
    return data;
  }
}
