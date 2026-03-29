import { z } from 'zod';

export const DriverSchema = z.object({
  id:            z.string(),
  tenantId:      z.string(),
  firebaseUid:   z.string(),
  email:         z.string().email().catch(''), // catch: existing docs pre-email migration
  name:          z.string().min(1).max(100),
  phone:         z.string().min(1).max(20),
  licenseNumber: z.string().min(1).max(30),
  busId:         z.string().nullable(),
  isActive:      z.boolean(),
  createdAt:     z.number(),
  updatedAt:     z.number(),
});

export type Driver = z.infer<typeof DriverSchema>;

/** School admin submits email; backend resolves firebaseUid via Firebase Auth. */
export const CreateDriverSchema = z.object({
  email:         z.string().email().max(254),
  name:          z.string().min(1).max(100),
  phone:         z.string().min(1).max(20),
  licenseNumber: z.string().min(1).max(30),
  busId:         z.string().nullable().optional(),
});

export type CreateDriverInput = z.infer<typeof CreateDriverSchema>;

export const UpdateDriverSchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  phone:         z.string().min(1).max(20).optional(),
  licenseNumber: z.string().min(1).max(30).optional(),
  busId:         z.string().nullable().optional(),
  isActive:      z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' },
);

export type UpdateDriverInput = z.infer<typeof UpdateDriverSchema>;
