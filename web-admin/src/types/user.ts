export type UserRole = 'super_admin' | 'school_admin' | 'manager' | 'driver' | 'parent';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;    // null for super_admin
  tenantName: string | null;  // null for super_admin; fetched at login for school_admin
  createdAt: number;
  updatedAt: number;
}
