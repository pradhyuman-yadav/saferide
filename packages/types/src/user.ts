import { z } from 'zod';

export const USER_ROLES = ['super_admin', 'school_admin', 'manager', 'driver', 'parent'] as const;
export type UserRole = typeof USER_ROLES[number];

export const UserProfileSchema = z.object({
  uid:       z.string(),
  email:     z.string().email(),
  name:      z.string().min(1).max(100),
  role:      z.enum(USER_ROLES),
  tenantId:  z.string().nullable(),
  status:    z.enum(['active', 'invited', 'suspended']),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
