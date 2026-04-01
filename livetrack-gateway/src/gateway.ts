/**
 * LiveTrackGateway — manages a single WebSocket connection.
 *
 * Lifecycle per connection:
 *   1. `start()` — send `connected`, begin keepalive ping loop.
 *   2. Client sends `{ type: "subscribe", busId }`.
 *   3. Gateway queries Firestore for the active trip on that bus.
 *      • No active trip → send `{ type: "trip_status", status: "idle" }`.
 *      • Active trip    → attach onSnapshot to the trip document.
 *   4. Every snapshot with a new location → push `{ type: "location", data }`.
 *   5. Snapshot shows `status: "ended"` → push `{ type: "trip_status", status: "ended" }`,
 *      detach listener.
 *   6. Client disconnects or ping times out → `cleanup()`.
 *
 * Tenant isolation: every Firestore query includes `tenantId == user.tenantId`
 * so a parent in tenant A cannot subscribe to buses in tenant B.
 */
import type { WebSocket } from 'ws';
import { getDb } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';
import type { UserProfile } from '@saferide/types';

// ── Message types ─────────────────────────────────────────────────────────────

export interface LocationData {
  busId:      string;
  tripId:     string;
  lat:        number;
  lon:        number;
  speed:      number | undefined;
  heading:    number | undefined;
  recordedAt: number;
}

export type OutboundMessage =
  | { type: 'connected' }
  | { type: 'trip_status'; status: 'active' | 'idle' | 'ended'; tripId?: string }
  | { type: 'location';    data: LocationData }
  | { type: 'ping' }
  | { type: 'error';       code: string; message: string };

export type InboundMessage =
  | { type: 'subscribe'; busId: string }
  | { type: 'pong' };

// ── Gateway ───────────────────────────────────────────────────────────────────

export class LiveTrackGateway {
  private busId:       string | null = null;
  private unsubscribe: (() => void)  | null = null;

  // setInterval handle — typed broadly so both Node and browser timers compile
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout:  ReturnType<typeof setTimeout>  | null = null;

  constructor(
    private readonly ws:             WebSocket,
    private readonly user:           UserProfile,
    private readonly pingIntervalMs: number = 30_000,
    private readonly pongTimeoutMs:  number = 10_000,
  ) {}

  /** Call once immediately after the WebSocket upgrade completes. */
  start(): void {
    this.send({ type: 'connected' });
    this.startPingLoop();

    this.ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as InboundMessage;
        this.handleMessage(msg);
      } catch {
        this.send({ type: 'error', code: 'INVALID_MESSAGE', message: 'Message must be valid JSON.' });
      }
    });

    this.ws.on('close', () => { this.cleanup(); });
    this.ws.on('error', () => { this.cleanup(); });
  }

  // ── Inbound message routing ────────────────────────────────────────────────

  private handleMessage(msg: InboundMessage): void {
    switch (msg.type) {
      case 'pong':
        // Client answered the keepalive probe — cancel the close timer
        if (this.pongTimeout !== null) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
        break;

      case 'subscribe':
        if (!msg.busId || typeof msg.busId !== 'string') {
          this.send({ type: 'error', code: 'INVALID_BUS_ID', message: 'busId must be a non-empty string.' });
          return;
        }
        void this.subscribe(msg.busId);
        break;

      default:
        this.send({ type: 'error', code: 'UNKNOWN_MESSAGE_TYPE', message: 'Unrecognised message type.' });
    }
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  private async subscribe(busId: string): Promise<void> {
    // Detach any existing listener — client may re-subscribe to a different bus
    if (this.unsubscribe !== null) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.busId = busId;

    const db       = getDb();
    const tenantId = this.user.tenantId;

    // Find the active trip for this bus in this tenant.
    // Uses composite index: trips(tenantId ASC, busId ASC, status ASC)
    const snapshot = await db
      .collection('trips')
      .where('tenantId', '==', tenantId)
      .where('busId',    '==', busId)
      .where('status',   '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) {
      this.send({ type: 'trip_status', status: 'idle' });
      return;
    }

    const tripId = snapshot.docs[0]!.id;
    this.send({ type: 'trip_status', status: 'active', tripId });

    // Attach real-time listener to the trip document.
    // onSnapshot fires once immediately with the current state, then on every change.
    this.unsubscribe = db
      .collection('trips')
      .doc(tripId)
      .onSnapshot((snap) => {
        if (!snap.exists) return;

        const data = snap.data() as Record<string, unknown>;

        if (data['status'] === 'ended') {
          this.send({ type: 'trip_status', status: 'ended' });
          // Detach — no more updates after the trip ends
          if (this.unsubscribe !== null) {
            this.unsubscribe();
            this.unsubscribe = null;
          }
          return;
        }

        // Push the latest denormalized location if present.
        // TripService.updateLatestLocation() keeps these fields current.
        if (data['latestLat'] !== undefined && data['latestLon'] !== undefined) {
          this.send({
            type: 'location',
            data: {
              busId,
              tripId,
              lat:        data['latestLat']        as number,
              lon:        data['latestLon']         as number,
              speed:      data['latestSpeed']       as number | undefined,
              heading:    data['latestHeading']     as number | undefined,
              recordedAt: data['latestRecordedAt']  as number,
            },
          });
        }
      });
  }

  // ── Keepalive ─────────────────────────────────────────────────────────────

  private startPingLoop(): void {
    if (this.pingIntervalMs === 0) return; // disabled in unit tests

    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });

      // Expect a pong within pongTimeoutMs — otherwise terminate
      this.pongTimeout = setTimeout(() => {
        logger.warn({ uid: this.user.uid }, 'WebSocket pong timeout — closing stale connection');
        this.ws.terminate();
      }, this.pongTimeoutMs);
    }, this.pingIntervalMs);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private send(msg: OutboundMessage): void {
    if (this.ws.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private cleanup(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout !== null) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
    if (this.unsubscribe !== null) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    logger.info({ uid: this.user.uid, busId: this.busId }, 'WebSocket connection cleaned up');
  }
}
