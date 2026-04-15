/**
 * BoardingService
 *
 * Manages driver-recorded boarding / deboarding events.
 * Phase 1: manual boarding only (driver taps a student name).
 * Phase 2: RFID scanner will set method='rfid' — no schema change needed.
 *
 * Error codes thrown (→ HTTP status):
 *   TRIP_NOT_FOUND     → 404
 *   TRIP_NOT_ACTIVE    → 409
 *   TRIP_NOT_OWNED     → 403
 *   STUDENT_NOT_FOUND  → 404
 *   STUDENT_NOT_ON_BUS → 422
 *   ALREADY_BOARDED    → 409
 */
import { getRtdb } from '@saferide/firebase-admin';
import { createServiceLogger } from '@saferide/logger';
import type { BoardingEvent, CreateBoardingEventInput } from '@saferide/types';
import { BoardingRepository } from '../repositories/boarding.repository';
import { TripRepository } from '../repositories/trip.repository';
import { StudentRepository } from '../repositories/student.repository';
import { NotificationService } from './notification.service';
import { WebhookService } from './webhook.service';

const log = createServiceLogger('boarding');

const boardingRepo  = new BoardingRepository();
const tripRepo      = new TripRepository();
const studentRepo   = new StudentRepository();
const notifications = new NotificationService();
const webhooks      = new WebhookService();

export class BoardingService {
  /**
   * Records a boarding or deboarding event for a student on an active trip.
   * Returns the created document ID.
   */
  async recordBoarding(
    tripId:   string,
    input:    CreateBoardingEventInput,
    driverId: string,
    tenantId: string,
  ): Promise<string> {
    // ── 1. Verify trip ──────────────────────────────────────────────────────
    const trip = await tripRepo.findById(tripId, tenantId);
    if (trip === null) throw new Error('TRIP_NOT_FOUND');
    if (trip.status !== 'active') throw new Error('TRIP_NOT_ACTIVE');
    if (trip.driverId !== driverId) throw new Error('TRIP_NOT_OWNED');

    // ── 2. Verify student ───────────────────────────────────────────────────
    const student = await studentRepo.findById(input.studentId, tenantId);
    if (student === null) throw new Error('STUDENT_NOT_FOUND');
    if (student.busId !== trip.busId) throw new Error('STUDENT_NOT_ON_BUS');

    // ── 3. Duplicate-board guard ────────────────────────────────────────────
    if (input.eventType === 'boarded') {
      const existing = await boardingRepo.findStudentBoardingInTrip(
        tripId, input.studentId, 'boarded', tenantId,
      );
      if (existing !== null) throw new Error('ALREADY_BOARDED');
    }

    // ── 4. Persist event ────────────────────────────────────────────────────
    const now = Date.now();
    const id  = await boardingRepo.create(
      {
        tenantId,
        tripId,
        studentId:  input.studentId,
        busId:      trip.busId,
        stopId:     input.stopId,
        eventType:  input.eventType,
        method:     input.method,
        recordedAt: input.recordedAt,
        createdAt:  now,
      },
      tenantId,
    );

    log.info(
      { boardingId: id, tripId, studentId: input.studentId, busId: trip.busId, eventType: input.eventType, tenantId },
      'Boarding event recorded',
    );

    // ── 5. RTDB real-time status ────────────────────────────────────────────
    await getRtdb()
      .ref(`boardingStatus/${trip.busId}/${input.studentId}`)
      .set({
        status:    input.eventType,
        tripId,
        stopId:    input.stopId,
        updatedAt: now,
      });

    // ── 6. Notify parent (fire-and-forget) ──────────────────────────────────
    // Use generic copy — student name must not pass through Expo's push
    // infrastructure (a third-party server) to minimise PII exposure per DPDP 2023.
    const title = input.eventType === 'boarded'
      ? 'Your child has boarded the bus'
      : 'Your child has left the bus';
    const body = input.eventType === 'boarded'
      ? `Boarding confirmed. Have a safe trip.`
      : `Your child has deboarded the bus.`;

    void notifications.notifyParentOfStudent(student.parentFirebaseUid, tenantId, title, body);

    // ── 7. Webhook (fire-and-forget) ─────────────────────────────────────────
    const webhookEvent = input.eventType === 'boarded' ? 'student.boarded' : 'student.deboarded';
    void webhooks.deliverEvent(
      webhookEvent,
      {
        tripId,
        busId:     trip.busId,
        studentId: input.studentId,
        stopId:    input.stopId,
        method:    input.method,
        eventType: input.eventType,
      },
      tenantId,
    );

    return id;
  }

  /**
   * Lists all boarding events for a trip, ordered by createdAt descending.
   */
  listBoarding(tripId: string, tenantId: string): Promise<BoardingEvent[]> {
    return boardingRepo.listByTripId(tripId, tenantId);
  }

  /**
   * Called fire-and-forget from TripService.endTrip.
   * Finds students still boarded at trip-end, fires deboard notifications and
   * webhooks for each, then clears the entire boardingStatus/{busId} RTDB node.
   */
  async sweepOnTripEnd(tripId: string, busId: string, tenantId: string): Promise<void> {
    try {
      const events = await boardingRepo.listByTripId(tripId, tenantId);

      // Group events by studentId, keeping the LATEST event per student.
      // listByTripId returns events ordered desc by createdAt, so the first
      // occurrence of each studentId is their most recent event.
      const latestByStudent = new Map<string, BoardingEvent>();
      for (const evt of events) {
        if (!latestByStudent.has(evt.studentId)) {
          latestByStudent.set(evt.studentId, evt);
        }
      }

      // Identify students still boarded (last event = 'boarded')
      const stillBoarded = [...latestByStudent.values()].filter(
        (e) => e.eventType === 'boarded',
      );

      for (const evt of stillBoarded) {
        const student = await studentRepo.findById(evt.studentId, tenantId);
        if (student === null) continue;

        // Update RTDB status
        await getRtdb()
          .ref(`boardingStatus/${busId}/${evt.studentId}`)
          .set({
            status:    'deboarded',
            tripId,
            stopId:    null,
            updatedAt: Date.now(),
          });

        // Notify parent — generic copy to avoid sending child's name through
        // Expo's third-party push infrastructure.
        void notifications.notifyParentOfStudent(
          student.parentFirebaseUid, tenantId,
          'Your child has arrived',
          `The bus trip has ended. Your child should be home soon.`,
        );

        // Webhook
        void webhooks.deliverEvent(
          'student.deboarded',
          { tripId, busId, studentId: evt.studentId, stopId: null, method: evt.method, eventType: 'deboarded' },
          tenantId,
        );

        log.info({ tripId, busId, studentId: evt.studentId, tenantId }, 'Trip-end sweep: student deboarded');
      }

      // Clear entire boardingStatus/{busId} RTDB node
      await getRtdb().ref(`boardingStatus/${busId}`).remove();

      log.info({ tripId, busId, tenantId, sweptCount: stillBoarded.length }, 'Boarding sweep complete');
    } catch (err) {
      log.error({ err, tripId, busId, tenantId }, 'sweepOnTripEnd failed — suppressed');
    }
  }
}
