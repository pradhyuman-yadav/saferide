import { z } from 'zod';

export const StudentSchema = z.object({
  id:                z.string(),
  tenantId:          z.string(),
  name:              z.string().min(1).max(100),
  parentFirebaseUid: z.string().catch(''), // catch: existing docs pre-uid migration
  parentName:        z.string().min(1).max(100),
  parentPhone:       z.string().min(1).max(20),
  parentEmail:       z.string().email().max(254),
  busId:             z.string().nullable(),
  stopId:            z.string().nullable(),
  isActive:          z.boolean(),
  createdAt:         z.number(),
  updatedAt:         z.number(),
});

export type Student = z.infer<typeof StudentSchema>;

/**
 * School admin submits name + parent contact details.
 * Backend resolves parentFirebaseUid via Firebase Auth (same as driver flow).
 */
export const CreateStudentSchema = z.object({
  name:        z.string().min(1).max(100),
  parentName:  z.string().min(1).max(100),
  parentPhone: z.string().min(1).max(20),
  parentEmail: z.string().email().max(254),
  busId:       z.string().nullable().optional(),
  stopId:      z.string().nullable().optional(),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

export const UpdateStudentSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  parentName:  z.string().min(1).max(100).optional(),
  parentPhone: z.string().min(1).max(20).optional(),
  parentEmail: z.string().email().max(254).optional(),
  busId:       z.string().nullable().optional(),
  stopId:      z.string().nullable().optional(),
  isActive:    z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' },
);

export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;
