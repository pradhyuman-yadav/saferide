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
  latestLat:          z.number().min(-90).max(90).optional(),
  latestLon:          z.number().min(-180).max(180).optional(),
  latestSpeed:        z.number().optional(),
  latestHeading:      z.number().optional(),
  latestRecordedAt:   z.number().optional(),

  /** SOS — set by driver, cleared when driver cancels or trip ends. */
  sosActive:      z.boolean().optional(),
  sosTriggeredAt: z.number().optional(),

  /** Geofencing — stopIds already alerted this trip; prevents re-alerting per ping. */
  alertedStopIds: z.array(z.string()).optional(),

  /** Speeding / rash-driving alert cooldowns — Unix ms of last alert sent. */
  lastSpeedingAlertAt:    z.number().optional(),
  lastRashDrivingAlertAt: z.number().optional(),

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
