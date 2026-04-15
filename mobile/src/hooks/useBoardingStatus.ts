/**
 * useBoardingStatus
 *
 * Subscribes to the Realtime Database `boardingStatus/{busId}` node.
 * The trip-service backend writes to this node on every board/deboard event
 * and clears it when the trip ends.
 *
 * Returns a map of studentId → { status, tripId, stopId, updatedAt }.
 * Returns an empty map when the bus is offline or no students are boarded.
 *
 * Usage:
 *   const boardingStatus = useBoardingStatus(busId);
 *   const myChildStatus  = boardingStatus[studentId];
 */
import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '@/firebase/config';
import type { BoardingEventType } from '@/api/trip.client';

export interface BoardingStatusEntry {
  status:    BoardingEventType;
  tripId:    string;
  stopId:    string | null;
  updatedAt: number;
}

/** Map from Firestore studentId → current boarding status for this bus trip. */
export type BoardingStatusMap = Record<string, BoardingStatusEntry>;

export function useBoardingStatus(busId: string): BoardingStatusMap {
  const [status, setStatus] = useState<BoardingStatusMap>({});

  useEffect(() => {
    if (!busId) return;

    let active = true;
    const boardingRef = ref(rtdb, `boardingStatus/${busId}`);

    const unsubscribe = onValue(boardingRef, (snapshot) => {
      if (!active) return;
      const data = snapshot.val() as BoardingStatusMap | null;
      setStatus(data ?? {});
    });

    return () => {
      active = false;
      unsubscribe();
      off(boardingRef);
    };
  }, [busId]);

  return status;
}
