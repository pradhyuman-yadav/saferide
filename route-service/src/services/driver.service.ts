import type { Driver, CreateDriverInput, UpdateDriverInput } from '@saferide/types';
import { createServiceLogger } from '@saferide/logger';
import { DriverRepository } from '../repositories/driver.repository';
import { findOrCreateFirebaseUser, sendSetupEmail } from '../utils/firebase-auth.utils';

const log = createServiceLogger('driver');

const repo = new DriverRepository();

export class DriverService {
  listDrivers(tenantId: string): Promise<Driver[]> {
    return repo.listByTenantId(tenantId);
  }

  /** Returns the driver if it exists and belongs to tenantId; null otherwise. */
  async findDriver(id: string, tenantId: string): Promise<Driver | null> {
    const driver = await repo.findById(id, tenantId);
    // Defense-in-depth: verify tenantId even if repo enforces it at query level
    if (driver !== null && driver.tenantId !== tenantId) return null;
    return driver;
  }

  /** Like findDriver but throws DRIVER_NOT_FOUND instead of returning null. */
  async getDriver(id: string, tenantId: string): Promise<Driver> {
    const driver = await this.findDriver(id, tenantId);
    if (driver === null) {
      log.warn({ driverId: id, tenantId }, 'driver not found');
      throw new Error('DRIVER_NOT_FOUND');
    }
    return driver;
  }

  async createDriver(input: CreateDriverInput, tenantId: string): Promise<Driver> {
    // Resolve Firebase UID server-side — school admin never touches Firebase console
    const firebaseUid = await findOrCreateFirebaseUser(input.email, input.name);

    const now = Date.now();
    const driverId = await repo.create({
      tenantId,
      firebaseUid,
      email:         input.email,
      name:          input.name,
      phone:         input.phone,
      licenseNumber: input.licenseNumber,
      busId:         input.busId ?? null,
      isActive:      true,
      createdAt:     now,
      updatedAt:     now,
    });

    // Send setup email so the driver can set their password and log in to the app
    await sendSetupEmail(input.email);

    const created = await repo.findById(driverId, tenantId);
    if (created === null) throw new Error('Failed to retrieve created driver');
    log.info({ driverId: created.id, tenantId, email: created.email }, 'driver created; setup email sent');
    return created;
  }

  async updateDriver(id: string, input: UpdateDriverInput, tenantId: string): Promise<Driver> {
    const existing = await this.findDriver(id, tenantId);
    if (existing === null) throw new Error('DRIVER_NOT_FOUND');

    await repo.update(id, tenantId, input);

    const updated = await repo.findById(id, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated driver');
    log.info({ driverId: id, tenantId, fields: Object.keys(input) }, 'driver updated');
    return updated;
  }

  async deleteDriver(id: string, tenantId: string): Promise<void> {
    const existing = await this.findDriver(id, tenantId);
    if (existing === null) throw new Error('DRIVER_NOT_FOUND');
    await repo.update(id, tenantId, { isActive: false });
    log.info({ driverId: id, tenantId }, 'driver soft-deleted (isActive → false)');
  }
}
