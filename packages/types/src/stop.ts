import { z } from 'zod';

export const StopSchema = z.object({
  id:                     z.string(),
  tenantId:               z.string(),
  routeId:                z.string(),
  name:                   z.string().min(1).max(100),
  sequence:               z.number().int().min(1),
  lat:                    z.number().min(-90).max(90),
  lon:                    z.number().min(-180).max(180),
  estimatedOffsetMinutes: z.number().int().min(0),
  createdAt:              z.number(),
  updatedAt:              z.number(),
});

export type Stop = z.infer<typeof StopSchema>;

export const CreateStopSchema = z.object({
  name:                   z.string().min(1).max(100),
  sequence:               z.number().int().min(1),
  lat:                    z.number().min(-90).max(90),
  lon:                    z.number().min(-180).max(180),
  estimatedOffsetMinutes: z.number().int().min(0),
});

export type CreateStopInput = z.infer<typeof CreateStopSchema>;

export const UpdateStopSchema = z.object({
  name:                   z.string().min(1).max(100).optional(),
  sequence:               z.number().int().min(1).optional(),
  lat:                    z.number().min(-90).max(90).optional(),
  lon:                    z.number().min(-180).max(180).optional(),
  estimatedOffsetMinutes: z.number().int().min(0).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' },
);

export type UpdateStopInput = z.infer<typeof UpdateStopSchema>;
