export type TenantStatus = 'pending' | 'trial' | 'active' | 'suspended' | 'cancelled';
export type TenantPlan = 'trial' | 'basic' | 'pro';

export interface Tenant {
  id: string;
  name: string;
  slug: string;           // kebab-case unique identifier
  city: string;
  state: string;
  status: TenantStatus;
  plan: TenantPlan;
  trialEndsAt: number | null;  // Unix ms; null for non-trial plans
  maxBuses: number;
  maxStudents: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  adminEmail: string;     // school_admin email (pending invite)
  createdAt: number;
  updatedAt: number;
}

export interface CreateTenantInput {
  name: string;
  city: string;
  state: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  adminEmail: string;
  plan: TenantPlan;
  maxBuses: number;
  maxStudents: number;
}
