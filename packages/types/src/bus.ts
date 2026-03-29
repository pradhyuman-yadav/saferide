import { z } from 'zod';

export const BUS_STATUSES = ['active', 'inactive', 'maintenance'] as const;
export type BusStatus = typeof BUS_STATUSES[number];

export const BusSchema = z.object({
  id:                 z.string(),
  tenantId:           z.string(),
  registrationNumber: z.string().min(1).max(20),
  make:               z.string().min(1).max(50),
  model:              z.string().min(1).max(50),
  year:               z.number().int().min(1990).max(2100),
  capacity:           z.number().int().min(1).max(100),
  // driverId / routeId use .catch(null) so existing Firestore docs without
  // these fields parse cleanly instead of throwing a validation error.
  driverId:           z.string().nullable().catch(null),
  routeId:            z.string().nullable().catch(null),
  status:             z.enum(BUS_STATUSES),
  createdAt:          z.number(),
  updatedAt:          z.number(),
});

export type Bus = z.infer<typeof BusSchema>;

export const CreateBusSchema = z.object({
  registrationNumber: z.string().min(1).max(20),
  make:               z.string().min(1).max(50),
  model:              z.string().min(1).max(50),
  year:               z.number().int().min(1990).max(2100),
  capacity:           z.number().int().min(1).max(100),
});

export type CreateBusInput = z.infer<typeof CreateBusSchema>;

export const UpdateBusSchema = z.object({
  registrationNumber: z.string().min(1).max(20).optional(),
  make:               z.string().min(1).max(50).optional(),
  model:              z.string().min(1).max(50).optional(),
  year:               z.number().int().min(1990).max(2100).optional(),
  capacity:           z.number().int().min(1).max(100).optional(),
  status:             z.enum(BUS_STATUSES).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' },
);

export type UpdateBusInput = z.infer<typeof UpdateBusSchema>;

// ── Assignment schemas (dedicated endpoints, not part of generic PATCH) ────

export const AssignBusDriverSchema = z.object({
  driverId: z.string().nullable(),
});
export type AssignBusDriverInput = z.infer<typeof AssignBusDriverSchema>;

export const AssignBusRouteSchema = z.object({
  routeId: z.string().nullable(),
});
export type AssignBusRouteInput = z.infer<typeof AssignBusRouteSchema>;
