import { getDb } from '@saferide/firebase-admin';
import { StopSchema } from '@saferide/types';
import type { Stop } from '@saferide/types';

/**
 * Read-only stop repository used by the geofence check.
 * Stops are keyed by routeId + tenantId — no write operations needed here;
 * stop CRUD belongs to route-service.
 */
export class StopRepository {
  async listByRouteId(routeId: string, tenantId: string): Promise<Stop[]> {
    const snap = await getDb()
      .collection('stops')
      .where('tenantId', '==', tenantId)
      .where('routeId',  '==', routeId)
      .orderBy('sequence', 'asc')
      .get();

    return snap.docs.map((d) => StopSchema.parse({ ...d.data(), id: d.id }));
  }
}
