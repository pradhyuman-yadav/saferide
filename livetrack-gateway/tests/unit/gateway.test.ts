/**
 * Unit tests — LiveTrackGateway
 *
 * Tests the gateway's message handling logic with a mock WebSocket and a mock
 * Firestore. No real network or Firebase connections are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserProfile } from '@saferide/types';

// ---------------------------------------------------------------------------
// Firestore mock — hoisted so it's available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockGet, mockOnSnapshot, mockUnsubscribe } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  let capturedCallback: ((snap: unknown) => void) | null = null;

  const mockOnSnapshot = vi.fn((cb: (snap: unknown) => void) => {
    capturedCallback = cb;
    return mockUnsubscribe;
  });

  // Expose the captured callback so tests can trigger Firestore updates
  (mockOnSnapshot as unknown as { trigger: (snap: unknown) => void }).trigger = (snap: unknown) => {
    capturedCallback?.(snap);
  };

  const mockGet = vi.fn().mockResolvedValue({ empty: true, docs: [] });

  return { mockGet, mockOnSnapshot, mockUnsubscribe };
});

vi.mock('@saferide/firebase-admin', () => ({
  getDb: () => ({
    collection: () => ({
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      get:    mockGet,
      doc:    () => ({ onSnapshot: mockOnSnapshot }),
    }),
  }),
}));

vi.mock('@saferide/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { LiveTrackGateway } from '../../src/gateway';

// ---------------------------------------------------------------------------
// Helper — fake WebSocket with event capture
// ---------------------------------------------------------------------------

function makeMockWs() {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};

  const ws = {
    readyState: 1 as number,
    send:       vi.fn(),
    terminate:  vi.fn(),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = [...(handlers[event] ?? []), handler];
    },
    // Test helper: emit an event to registered handlers
    emit: (event: string, ...args: unknown[]) => {
      handlers[event]?.forEach((h) => h(...args));
    },
  };

  return ws;
}

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid:       'test-uid',
    email:     'test@example.com',
    name:      'Test User',
    role:      'parent',
    tenantId:  'tenant-001',
    status:    'active',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function parseSent(ws: ReturnType<typeof makeMockWs>, callIndex = 0): unknown {
  return JSON.parse(ws.send.mock.calls[callIndex]![0] as string);
}

function triggerSnapshot(snap: unknown) {
  (mockOnSnapshot as unknown as { trigger: (snap: unknown) => void }).trigger(snap);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LiveTrackGateway.start()', () => {
  let ws: ReturnType<typeof makeMockWs>;

  beforeEach(() => {
    vi.clearAllMocks();
    ws = makeMockWs();
  });

  it('sends { type: "connected" } immediately on start', () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    expect(ws.send).toHaveBeenCalledOnce();
    expect(parseSent(ws)).toEqual({ type: 'connected' });
  });

  it('registers message, close, and error handlers', () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    const onSpy = vi.spyOn(ws, 'on');
    gw.start();

    const events = onSpy.mock.calls.map(([evt]) => evt);
    expect(events).toContain('message');
    expect(events).toContain('close');
    expect(events).toContain('error');
  });
});

describe('subscribe — no active trip', () => {
  let ws: ReturnType<typeof makeMockWs>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ empty: true, docs: [] });
    ws = makeMockWs();
  });

  it('sends { type: "trip_status", status: "idle" } when no trip is active', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(ws.send).toHaveBeenCalledTimes(2));

    expect(parseSent(ws, 1)).toEqual({ type: 'trip_status', status: 'idle' });
  });

  it('does not attach a Firestore listener when no trip is active', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(ws.send).toHaveBeenCalledTimes(2));

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});

describe('subscribe — active trip found', () => {
  let ws: ReturnType<typeof makeMockWs>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      empty: false,
      docs:  [{ id: 'trip-001', data: () => ({ status: 'active', busId: 'bus-001' }) }],
    });
    ws = makeMockWs();
  });

  it('sends trip_status: active with tripId', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(ws.send).toHaveBeenCalledTimes(2));

    expect(parseSent(ws, 1)).toEqual({ type: 'trip_status', status: 'active', tripId: 'trip-001' });
  });

  it('attaches a Firestore onSnapshot listener', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledOnce());
  });

  it('pushes location message when snapshot contains latestLat/latestLon', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledOnce());

    triggerSnapshot({
      exists: true,
      data: () => ({
        status:          'active',
        latestLat:       12.9716,
        latestLon:       77.5946,
        latestSpeed:     45,
        latestHeading:   90,
        latestRecordedAt: 1700000001000,
      }),
    });

    expect(ws.send).toHaveBeenCalledTimes(3); // connected + trip_status + location
    expect(parseSent(ws, 2)).toMatchObject({
      type: 'location',
      data: {
        busId:      'bus-001',
        tripId:     'trip-001',
        lat:        12.9716,
        lon:        77.5946,
        speed:      45,
        heading:    90,
        recordedAt: 1700000001000,
      },
    });
  });

  it('does not push a location message when latestLat is absent', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledOnce());

    // Snapshot with no location data yet (trip just started)
    triggerSnapshot({
      exists: true,
      data:   () => ({ status: 'active' }),
    });

    expect(ws.send).toHaveBeenCalledTimes(2); // connected + trip_status only
  });

  it('sends trip_status: ended when snapshot shows status = ended', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledOnce());

    triggerSnapshot({
      exists: true,
      data:   () => ({ status: 'ended' }),
    });

    expect(parseSent(ws, 2)).toEqual({ type: 'trip_status', status: 'ended' });
  });

  it('detaches the Firestore listener when trip ends', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledOnce());

    triggerSnapshot({ exists: true, data: () => ({ status: 'ended' }) });

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});

describe('subscribe — re-subscription', () => {
  let ws: ReturnType<typeof makeMockWs>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      empty: false,
      docs:  [{ id: 'trip-001', data: () => ({}) }],
    });
    ws = makeMockWs();
  });

  it('detaches the old listener before attaching a new one', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(1));

    // Re-subscribe to a different bus
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-002' })));
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));

    // The first listener should have been unsubscribed
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});

describe('inbound message handling', () => {
  let ws: ReturnType<typeof makeMockWs>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ empty: true, docs: [] });
    ws = makeMockWs();
  });

  it('sends an error for invalid JSON', () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from('not-valid-json'));

    expect(parseSent(ws, 1)).toMatchObject({ type: 'error', code: 'INVALID_MESSAGE' });
  });

  it('sends an error for an unknown message type', () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'fly_to_moon' })));

    expect(parseSent(ws, 1)).toMatchObject({ type: 'error', code: 'UNKNOWN_MESSAGE_TYPE' });
  });

  it('sends an error when busId is missing from subscribe', () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe' })));

    expect(parseSent(ws, 1)).toMatchObject({ type: 'error', code: 'INVALID_BUS_ID' });
  });
});

describe('connection cleanup', () => {
  let ws: ReturnType<typeof makeMockWs>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      empty: false,
      docs:  [{ id: 'trip-001', data: () => ({}) }],
    });
    ws = makeMockWs();
  });

  it('detaches the Firestore listener when the WebSocket closes', async () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', busId: 'bus-001' })));
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledOnce());

    ws.emit('close');

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it('does not send messages after WebSocket is closed', async () => {
    ws.readyState = 3; // CLOSED
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    // `connected` message should not be sent because readyState !== OPEN
    expect(ws.send).not.toHaveBeenCalled();
  });
});

describe('pong handling', () => {
  let ws: ReturnType<typeof makeMockWs>;

  beforeEach(() => {
    vi.clearAllMocks();
    ws = makeMockWs();
  });

  it('does not crash when a pong is received with no pending pong timer', () => {
    const gw = new LiveTrackGateway(ws as never, makeUser(), 0, 0);
    gw.start();

    // No ping was sent — pong should be silently ignored
    expect(() => {
      ws.emit('message', Buffer.from(JSON.stringify({ type: 'pong' })));
    }).not.toThrow();
  });
});
