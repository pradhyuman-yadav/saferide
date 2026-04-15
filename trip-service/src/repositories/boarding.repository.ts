import { getDb } from '@saferide/firebase-admin';
import { BoardingEventSchema } from '@saferide/types';
import type { BoardingEvent, BoardingEventType } from '@saferide/types';

export class BoardingRepository {
  /**
   * Persists a new boarding event document and returns the generated Firestore ID.
   * `id` inside `data` is ignored — Firestore auto-generates one.
   */
  async create(
    data: Omit<BoardingEvent, 'id'>,
    tenantId: string,
  ): Promise<string> {
    const ref = await getDb()
      .collection('boardingEvents')
      .add({ ...data, tenantId });
    return ref.id;
  }

  /**
   * Returns all boarding events for a trip, ordered by createdAt descending.
   * Enforces tenant isolation via the tenantId query clause.
   */
  async listByTripId(tripId: string, tenantId: string): Promise<BoardingEvent[]> {
    const snap = await getDb()
      .collection('boardingEvents')
      .where('tenantId', '==', tenantId)
      .where('tripId',   '==', tripId)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((d) => BoardingEventSchema.parse({ ...d.data(), id: d.id }));
  }

  /**
   * Returns the most recent boarding event of a given eventType for a student
   * on a specific trip, or null if no match. Used for the ALREADY_BOARDED check.
   */
  async findStudentBoardingInTrip(
    tripId:    string,
    studentId: string,
    eventType: BoardingEventType,
    tenantId:  string,
  ): Promise<BoardingEvent | null> {
    const snap = await getDb()
      .collection('boardingEvents')
      .where('tenantId',  '==', tenantId)
      .where('tripId',    '==', tripId)
      .where('studentId', '==', studentId)
      .where('eventType', '==', eventType)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    const [doc] = snap.docs;
    if (!doc) return null;
    return BoardingEventSchema.parse({ ...doc.data(), id: doc.id });
  }
}
