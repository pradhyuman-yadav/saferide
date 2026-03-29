import { z } from 'zod';
import { USER_ROLES } from './user';

export const PendingInviteSchema = z.object({
  tenantId:    z.string(),
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
