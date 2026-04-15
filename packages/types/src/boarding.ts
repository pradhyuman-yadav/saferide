import { z } from 'zod';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * 'manual' — driver taps a student name in the app.
 * 'rfid'   — RFID scanner sends a scan event (not yet implemented; reserved for
 *            Phase 2 when hardware integration ships).
 */
export const BOARDING_METHODS = ['manual', 'rfid'] as const;
export type BoardingMethod = (typeof BOARDING_METHODS)[number];

export const BOARDING_EVENT_TYPES = ['boarded', 'deboarded'] as const;
export type BoardingEventType = (typeof BOARDING_EVENT_TYPES)[number];

// ── Domain entity ─────────────────────────────────────────────────────────────

export const BoardingEventSchema = z.object({
  id:         z.string(),
  tenantId:   z.string(),
  tripId:     z.string(),
  studentId:  z.string(),
  busId:      z.string(),
  /** null when the deboard was triggered by the trip-end sweep (no specific stop). */
  stopId:     z.string().nullable(),
  eventType:  z.enum(BOARDING_EVENT_TYPES),
  /** Reserved for RFID Phase 2. */
  method:     z.enum(BOARDING_METHODS),
  recordedAt: z.number(),  // Unix ms — set by driver device
  createdAt:  z.number(),  // Unix ms — set by server on receipt
});

export type BoardingEvent = z.infer<typeof BoardingEventSchema>;

// ── Input schema ──────────────────────────────────────────────────────────────

/**
 * Phase 1: only 'manual' is accepted. The schema uses z.literal so the
 * controller rejects any other value. When RFID ships, widen to z.enum.
 */
export const CreateBoardingEventSchema = z.object({
  studentId:  z.string().min(1),
  stopId:     z.string().nullable(),
  eventType:  z.enum(BOARDING_EVENT_TYPES),
  method:     z.literal('manual'),
  recordedAt: z.number(),
});

export type CreateBoardingEventInput = z.infer<typeof CreateBoardingEventSchema>;

// ── RTDB shape (boardingStatus/{busId}/{studentId}) ───────────────────────────

export interface BoardingStatusEntry {
  status:    BoardingEventType;
  tripId:    string;
  stopId:    string | null;
  updatedAt: number;
}
