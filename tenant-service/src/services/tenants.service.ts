import type { Tenant, CreateTenantInput } from '@saferide/types';
import { TenantsRepository } from '../repositories/tenants.repository';

const repo = new TenantsRepository();

export class TenantsService {
  listTenants(): Promise<Tenant[]> {
    return repo.listAll();
  }

  getTenant(id: string): Promise<Tenant | null> {
    return repo.findById(id);
  }

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    const now  = Date.now();
    const slug = generateSlug(input.name);

    // All tenants start as 'pending' — trial/active status begins only when
    // the school admin claims their invite and activates the account.
    const tenantId = await repo.create({
      name:         input.name,
      slug,
      city:         input.city,
      state:        input.state,
      status:       'pending',
      plan:         input.plan,
      trialEndsAt:  null,          // set by auth-service on invite claim
      maxBuses:     input.maxBuses,
      maxStudents:  input.maxStudents,
      contactName:  input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      adminEmail:   input.adminEmail,
      createdAt:    now,
      updatedAt:    now,
    });

    // Store plan in invite so auth-service knows what status to activate with
    const inviteKey = input.adminEmail.replace(/[@.]/g, '_');
    await repo.createInvite(inviteKey, {
      tenantId,
      email:       input.adminEmail,
      role:        'school_admin',
      plan:        input.plan,
      contactName: input.contactName,
      createdAt:   now,
      updatedAt:   now,
    });

    const created = await repo.findById(tenantId);
    if (created === null) throw new Error('Failed to retrieve created tenant');
    return created;
  }

  suspendTenant(id: string): Promise<void> {
    return repo.updateStatus(id, 'suspended');
  }

  reactivateTenant(id: string): Promise<void> {
    return repo.updateStatus(id, 'active');
  }
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
