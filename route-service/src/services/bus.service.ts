import type { Bus, CreateBusInput, UpdateBusInput } from '@saferide/types';
import { getDb } from '@saferide/firebase-admin';
import { BusRepository } from '../repositories/bus.repository';
import { DriverRepository } from '../repositories/driver.repository';
import { RouteRepository }   from '../repositories/route.repository';
import { StopRepository }    from '../repositories/stop.repository';
import { StudentRepository } from '../repositories/student.repository';

const repo        = new BusRepository();
const driverRepo  = new DriverRepository();
const routeRepo   = new RouteRepository();
const stopRepo    = new StopRepository();
const studentRepo = new StudentRepository();

export class BusService {
  listBuses(tenantId: string): Promise<Bus[]> {
    return repo.listByTenantId(tenantId);
  }

  /** Returns the bus if it exists and belongs to tenantId; null otherwise. */
  async findBus(id: string, tenantId: string): Promise<Bus | null> {
    return repo.findById(id, tenantId);
  }

  /** Like findBus but throws BUS_NOT_FOUND instead of returning null. */
  async getBus(id: string, tenantId: string): Promise<Bus> {
    const bus = await this.findBus(id, tenantId);
    if (bus === null) throw new Error('BUS_NOT_FOUND');
    return bus;
  }

  async createBus(input: CreateBusInput, tenantId: string): Promise<Bus> {
    const now = Date.now();
    const busId = await repo.create({
      tenantId,
      registrationNumber: input.registrationNumber,
      make:               input.make,
      model:              input.model,
      year:               input.year,
      capacity:           input.capacity,
      driverId:           null,
      routeId:            null,
      status:             'active',
      createdAt:          now,
      updatedAt:          now,
    });

    const created = await repo.findById(busId, tenantId);
    if (created === null) throw new Error('Failed to retrieve created bus');
    return created;
  }

  async updateBus(id: string, input: UpdateBusInput, tenantId: string): Promise<Bus> {
    const existing = await this.findBus(id, tenantId);
    if (existing === null) throw new Error('BUS_NOT_FOUND');

    await repo.update(id, tenantId, input);

    const updated = await repo.findById(id, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated bus');
    return updated;
  }

  async deleteBus(id: string, tenantId: string): Promise<void> {
    const existing = await this.findBus(id, tenantId);
    if (existing === null) throw new Error('BUS_NOT_FOUND');
    await repo.update(id, tenantId, { status: 'inactive' });
  }

  /**
   * Atomically assigns (or unassigns) a driver to a bus.
   * Uses a Firestore batch to keep driver.busId ↔ bus.driverId in sync.
   */
  async assignDriver(busId: string, driverId: string | null, tenantId: string): Promise<Bus> {
    const bus = await this.findBus(busId, tenantId);
    if (bus === null) throw new Error('BUS_NOT_FOUND');

    const now = Date.now();
    const db  = getDb();
    const batch = db.batch();

    if (driverId !== null) {
      const driver = await driverRepo.findById(driverId, tenantId);
      if (driver === null) throw new Error('DRIVER_NOT_FOUND');

      // 1. Clear the previous driver's busId (they're no longer on this bus)
      if (bus.driverId !== null && bus.driverId !== driverId) {
        batch.update(db.collection('drivers').doc(bus.driverId), { busId: null, updatedAt: now });
      }
      // 2. Unlink the new driver from any other bus they were on
      if (driver.busId !== null && driver.busId !== busId) {
        batch.update(db.collection('buses').doc(driver.busId), { driverId: null, updatedAt: now });
      }
      // 3. Point the driver to this bus
      batch.update(db.collection('drivers').doc(driverId), { busId, updatedAt: now });
      // 4. Point the bus to this driver
      batch.update(db.collection('buses').doc(busId), { driverId, updatedAt: now });
    } else {
      // Unassign: clear both sides
      batch.update(db.collection('buses').doc(busId), { driverId: null, updatedAt: now });
      if (bus.driverId !== null) {
        batch.update(db.collection('drivers').doc(bus.driverId), { busId: null, updatedAt: now });
      }
    }

    await batch.commit();

    const updated = await repo.findById(busId, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated bus');
    return updated;
  }

  /**
   * Assigns (or unassigns) a route to a bus.
   * Rules enforced:
   *   - One bus per route: rejects if another bus already serves this route.
   *   - Cascade: when the bus moves routes, students on the old route's stops
   *     have their busId cleared; students on the new route's stops have their
   *     busId set to this bus.
   */
  async assignRoute(busId: string, routeId: string | null, tenantId: string): Promise<Bus> {
    const bus = await this.findBus(busId, tenantId);
    if (bus === null) throw new Error('BUS_NOT_FOUND');

    if (routeId !== null) {
      const route = await routeRepo.findById(routeId, tenantId);
      if (route === null) throw new Error('ROUTE_NOT_FOUND');

      // Enforce one bus per route
      const existing = await repo.findByRouteId(routeId, tenantId);
      if (existing !== null && existing.id !== busId) {
        throw new Error('ROUTE_ALREADY_HAS_BUS');
      }
    }

    const previousRouteId = bus.routeId;
    await repo.update(busId, tenantId, { routeId });

    // ── Cascade: clear busId for students on the old route ──────────────────
    if (previousRouteId !== null && previousRouteId !== routeId) {
      const oldStops = await stopRepo.listByRouteId(previousRouteId, tenantId);
      if (oldStops.length > 0) {
        const oldStudents = await studentRepo.listByStopIds(oldStops.map((s) => s.id), tenantId);
        await Promise.all(oldStudents.map((s) => studentRepo.update(s.id, tenantId, { busId: null })));
      }
    }

    // ── Cascade: set busId for students on the new route ────────────────────
    if (routeId !== null) {
      const newStops = await stopRepo.listByRouteId(routeId, tenantId);
      if (newStops.length > 0) {
        const newStudents = await studentRepo.listByStopIds(newStops.map((s) => s.id), tenantId);
        await Promise.all(newStudents.map((s) => studentRepo.update(s.id, tenantId, { busId })));
      }
    }

    const updated = await repo.findById(busId, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated bus');
    return updated;
  }
}
