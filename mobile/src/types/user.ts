/** Full role hierarchy — super_admin/school_admin use web dashboard, others use mobile. */
export type UserRole = 'super_admin' | 'school_admin' | 'manager' | 'driver' | 'parent';

export interface UserProfile {
  uid: string;
  role: UserRole;
  name: string;
  phone?: string;
  email?: string;
  tenantId: string;       // school ID — enforced everywhere; empty string for super_admin
  schoolName?: string;
  createdAt: number;      // Unix ms
  updatedAt: number;

  // parent-specific
  childName?: string;
  childClass?: string;
  busId?: string;
  stopId?: string;
  preferredLanguage?: string;

  // driver-specific
  licenseNumber?: string;
  assignedBusId?: string;
  assignedRouteId?: string;
}
