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

  /**
   * Returns any active student whose parent matches the given Firebase UID
   * AND who is assigned to the given bus.
   * Used to verify a parent's access to a specific bus before returning trip data.
   */
  async findByParentUidAndBusId(
    parentFirebaseUid: string,
    busId:             string,
    tenantId:          string,
  ): Promise<Student | null> {
    const snap = await getDb()
      .collection('students')
      .where('tenantId',          '==', tenantId)
      .where('parentFirebaseUid', '==', parentFirebaseUid)
      .where('busId',             '==', busId)
      .where('isActive',          '==', true)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return StudentSchema.parse({ ...snap.docs[0]!.data(), id: snap.docs[0]!.id });
  }
}
