import { z } from 'zod';
import { USER_ROLES } from './user';

export const PendingInviteSchema = z.object({
  tenantId:    z.string().nullable(),               // null for super_admin (platform-level) invites
  email:       z.string().email(),
  role:        z.enum(USER_ROLES),
  plan:        z.enum(['trial', 'basic', 'pro']),   // used by auth-service to activate tenant
  contactName: z.string().optional(),
  createdAt:   z.number(),
  updatedAt:   z.number(),
});

export type PendingInvite = z.infer<typeof PendingInviteSchema>;

export const ClaimInviteSchema = z.object({
  idToken: z.string().min(1),
});

export type ClaimInviteInput = z.infer<typeof ClaimInviteSchema>;

// Used by the Super Admin "Create Account" form
export const CreateInviteInputSchema = z.object({
  email:    z.string().email().max(254),
  name:     z.string().min(1).max(100),
  role:     z.enum(['super_admin', 'school_admin', 'manager']),
  tenantId: z.string().optional(),
}).refine(
  (data) => data.role === 'super_admin' || !!data.tenantId,
  { message: 'School is required for school_admin and manager roles.', path: ['tenantId'] },
);

export type CreateInviteInput = z.infer<typeof CreateInviteInputSchema>;
