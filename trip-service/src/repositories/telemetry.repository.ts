import { getDb } from '@saferide/firebase-admin';
import { GpsTelemetrySchema } from '@saferide/types';
import type { GpsTelemetry } from '@saferide/types';

export class TelemetryRepository {
  private col() {
    return getDb().collection('gpsTelemetry');
  }

  /** Most recent telemetry ping for a trip. */
  async findLatestByTripId(tripId: string, tenantId: string): Promise<GpsTelemetry | null> {
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .where('tripId', '==', tripId)
      .orderBy('recordedAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return GpsTelemetrySchema.parse({ ...d.data(), id: d.id });
  }

  async create(data: Omit<GpsTelemetry, 'id'>): Promise<string> {
    const ref = await this.col().add(data);
    return ref.id;
  }
}
