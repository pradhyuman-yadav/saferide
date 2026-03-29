import { z } from 'zod';

export const RouteSchema = z.object({
  id:          z.string(),
  tenantId:    z.string(),
  name:        z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  isActive:    z.boolean(),
  createdAt:   z.number(),
  updatedAt:   z.number(),
});

export type Route = z.infer<typeof RouteSchema>;

export const CreateRouteSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

export type CreateRouteInput = z.infer<typeof CreateRouteSchema>;

export const UpdateRouteSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive:    z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' },
);

export type UpdateRouteInput = z.infer<typeof UpdateRouteSchema>;
