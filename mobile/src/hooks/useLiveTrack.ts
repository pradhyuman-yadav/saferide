/**
 * useLiveTrack
 * Subscribes to the Realtime Database `liveLocation/{busId}` node.
 * The driver's phone writes to this node on every GPS ping (every ~10s).
 * Firebase SDK propagates the change to all connected clients instantly —
 * no polling, no WebSocket gateway service needed.
 *
 * Returns null location when the bus is offline (trip ended or not started).
 *
 * Phase 3 (if needed): swap the RTDB subscription for a dedicated
 * livetrack-gateway WebSocket when multi-region or MQTT is required.
 *
 * Usage:
 *   const { location, isConnected } = useLiveTrack(busId);
 */
import { useEffect, useRef, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '@/firebase/config';

export interface LiveLocation {
  tripId:     string;
  lat:        number;
  lon:        number;
  speed:      number | null;
  heading:    number | null;
  accuracy:   number | null;
  recordedAt: number;
  updatedAt:  number;
}

interface LiveTrackState {
  location:    LiveLocation | null;
  isConnected: boolean;
}

export function useLiveTrack(busId: string): LiveTrackState {
  const [location, setLocation]     = useState<LiveLocation | null>(null);
  const [isConnected, setConnected] = useState(false);

  // Keep a ref to busId so we can compare in cleanup without stale closure
  const busIdRef   = useRef(busId);
  busIdRef.current = busId;

  useEffect(() => {
    if (!busId) return;

    let active = true; // guard: prevents setState after unmount
    const locRef = ref(rtdb, `liveLocation/${busId}`);

    const unsubscribe = onValue(locRef, (snapshot) => {
      if (!active) return; // component may have unmounted before this fires
      const data = snapshot.val() as LiveLocation | null;
      setLocation(data);
      setConnected(data !== null);
    });

    // Firebase `onValue` returns an unsubscribe function directly
    return () => {
      active = false;
      unsubscribe();
      off(locRef);
    };
  }, [busId]);

  return { location, isConnected };
}
