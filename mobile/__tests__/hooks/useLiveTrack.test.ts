/**
 * useLiveTrack hook tests
 *
 * The hook subscribes to Firebase RTDB `liveLocation/{busId}`.
 * We mock the Firebase SDK so no real network calls are made.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useLiveTrack, type LiveLocation } from '@/hooks/useLiveTrack';

// ── Firebase RTDB mock ────────────────────────────────────────────────────────
// jest.mock is hoisted before variable declarations, so we can't reference
// outer `let` variables inside the factory. Use jest.requireMock() below
// to grab the mocked functions after setup.

let capturedCb: ((snap: { val: () => LiveLocation | null }) => void) | null = null;

jest.mock('@/firebase/config', () => ({ rtdb: {} }));

jest.mock('firebase/database', () => ({
  ref:     jest.fn(() => ({})),
  onValue: jest.fn((_ref: unknown, cb: (snap: { val: () => LiveLocation | null }) => void) => {
    capturedCb = cb;
    return jest.fn(); // unsubscribe fn returned by onValue
  }),
  off: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_LOCATION: LiveLocation = {
  tripId:     'trip_001',
  lat:        12.9784,
  lon:        77.6408,
  speed:      48,
  heading:    135,
  accuracy:   5,
  recordedAt: Date.now() - 3000,
  updatedAt:  Date.now(),
};

function fireLocation(data: LiveLocation | null) {
  act(() => { capturedCb?.({ val: () => data }); });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useLiveTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedCb = null;
  });

  it('starts as not connected with null location', () => {
    const { result } = renderHook(() => useLiveTrack('bus_007'));

    expect(result.current.location).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('becomes connected when RTDB fires a location', () => {
    const { result } = renderHook(() => useLiveTrack('bus_007'));

    fireLocation(MOCK_LOCATION);

    expect(result.current.isConnected).toBe(true);
    expect(result.current.location).toMatchObject({
      lat: MOCK_LOCATION.lat,
      lon: MOCK_LOCATION.lon,
    });
  });

  it('location has all required fields', () => {
    const { result } = renderHook(() => useLiveTrack('bus_007'));

    fireLocation(MOCK_LOCATION);

    const loc = result.current.location!;
    expect(loc.tripId).toBeDefined();
    expect(typeof loc.lat).toBe('number');
    expect(typeof loc.lon).toBe('number');
    expect(loc.updatedAt).toBeGreaterThan(0);
  });

  it('becomes disconnected when location is set to null', () => {
    const { result } = renderHook(() => useLiveTrack('bus_007'));

    fireLocation(MOCK_LOCATION);
    expect(result.current.isConnected).toBe(true);

    fireLocation(null);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.location).toBeNull();
  });

  it('does not subscribe when busId is empty', () => {
    const { onValue } = jest.requireMock('firebase/database') as { onValue: jest.Mock };
    renderHook(() => useLiveTrack(''));

    expect(onValue).not.toHaveBeenCalled();
  });

  it('calls off on unmount', () => {
    const { off } = jest.requireMock('firebase/database') as { off: jest.Mock };
    const { unmount } = renderHook(() => useLiveTrack('bus_007'));

    unmount();

    expect(off).toHaveBeenCalled();
  });
});
