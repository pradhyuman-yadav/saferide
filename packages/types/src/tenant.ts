import { z } from 'zod';

export const TENANT_STATUSES = ['pending', 'trial', 'active', 'suspended', 'cancelled'] as const;
export const TENANT_PLANS    = ['trial', 'basic', 'pro'] as const;

export type TenantStatus = typeof TENANT_STATUSES[number];
export type TenantPlan   = typeof TENANT_PLANS[number];

export const TenantSchema = z.object({
  id:           z.string(),
  name:         z.string().min(1).max(100),
  slug:         z.string(),
  city:         z.string().min(1).max(100),
  state:        z.string().min(1).max(100),
  status:       z.enum(TENANT_STATUSES),
  plan:         z.enum(TENANT_PLANS),
  trialEndsAt:  z.number().nullable(),
  maxBuses:     z.number().int().positive(),
  maxStudents:  z.number().int().positive(),
  contactName:  z.string().min(1).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(10).max(15),
  adminEmail:   z.string().email(),
  createdAt:    z.number(),
  updatedAt:    z.number(),
});

export type Tenant = z.infer<typeof TenantSchema>;

export const CreateTenantSchema = z.object({
  name:         z.string().min(1).max(100),
  city:         z.string().min(1).max(100),
  state:        z.string().min(1).max(100),
  plan:         z.enum(TENANT_PLANS),
  maxBuses:     z.number().int().min(1).max(500),
  maxStudents:  z.number().int().min(1).max(100_000),
  contactName:  z.string().min(1).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  adminEmail:   z.string().email(),
});

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
