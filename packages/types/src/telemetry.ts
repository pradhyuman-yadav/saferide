import { z } from 'zod';

// ── Domain entity ─────────────────────────────────────────────────────────────

export const GpsTelemetrySchema = z.object({
  id:         z.string(),
  tenantId:   z.string(),
  tripId:     z.string(),
  driverId:   z.string(),
  busId:      z.string(),
  lat:        z.number().min(-90).max(90),
  lon:        z.number().min(-180).max(180),
  speed:      z.number().min(0).optional(),    // km/h
  heading:    z.number().min(0).max(360).optional(), // degrees
  accuracy:   z.number().min(0).optional(),    // metres
  recordedAt: z.number(),                      // Unix ms — set by driver device
  createdAt:  z.number(),                      // Unix ms — set by server on receipt
});

export type GpsTelemetry = z.infer<typeof GpsTelemetrySchema>;

// ── Input schema ──────────────────────────────────────────────────────────────

export const CreateTelemetryInputSchema = z.object({
  lat:        z.number().min(-90).max(90),
  lon:        z.number().min(-180).max(180),
  speed:      z.number().min(0).optional(),
  heading:    z.number().min(0).max(360).optional(),
  accuracy:   z.number().min(0).optional(),
  recordedAt: z.number(),
});

export type CreateTelemetryInput = z.infer<typeof CreateTelemetryInputSchema>;
