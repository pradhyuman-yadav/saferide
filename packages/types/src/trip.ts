import { z } from 'zod';

// ── Status ────────────────────────────────────────────────────────────────────

export const TRIP_STATUSES = ['active', 'ended'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

// ── Domain entity ─────────────────────────────────────────────────────────────

export const TripSchema = z.object({
  id:        z.string(),
  tenantId:  z.string(),
  driverId:  z.string(),
  busId:     z.string(),
  routeId:   z.string(),
  status:    z.enum(TRIP_STATUSES),
  startedAt: z.number(),
  endedAt:   z.number().optional(),

  /** Denormalized from the latest telemetry ping — fast parent reads without joins. */
  latestLat:          z.number().optional(),
  latestLon:          z.number().optional(),
  latestSpeed:        z.number().optional(),
  latestHeading:      z.number().optional(),
  latestRecordedAt:   z.number().optional(),

  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Trip = z.infer<typeof TripSchema>;

// ── Input schemas ─────────────────────────────────────────────────────────────

export const StartTripInputSchema = z.object({
  busId:   z.string().min(1),
  routeId: z.string().min(1),
});

export type StartTripInput = z.infer<typeof StartTripInputSchema>;
