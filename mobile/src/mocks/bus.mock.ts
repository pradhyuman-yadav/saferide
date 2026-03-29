import type { BusState, FleetBus } from '@/types/bus';

// Mock bus position: Indiranagar, Bangalore
export const MOCK_BUS: BusState = {
  busId:        'bus_007',
  busNumber:    '7',
  driverName:   'Raju Sharma',
  driverPhone:  '+91 98765 43210',
  routeName:    'Route A — Indiranagar',
  coords: {
    latitude:  12.9784,
    longitude: 77.6408,
  },
  heading:      135,
  speedKmh:     48,
  status:       'on_route',
  etaMinutes:   4,
  nextStop:     'Indiranagar 5th Cross',
  lastUpdated:  Date.now(),
  stops: [
    { id: 's1', name: 'CMH Road', coords: { latitude: 12.9720, longitude: 77.6387 }, etaMinutes: 0, reached: true },
    { id: 's2', name: 'Indiranagar 100 Ft Rd', coords: { latitude: 12.9745, longitude: 77.6395 }, etaMinutes: 0, reached: true },
    { id: 's3', name: 'Indiranagar 5th Cross', coords: { latitude: 12.9784, longitude: 77.6408 }, etaMinutes: 4, reached: false },
    { id: 's4', name: 'Domlur Flyover', coords: { latitude: 12.9612, longitude: 77.6365 }, etaMinutes: 9, reached: false },
    { id: 's5', name: 'HAL Old Airport Rd', coords: { latitude: 12.9583, longitude: 77.6409 }, etaMinutes: 14, reached: false },
    { id: 's6', name: 'Delhi Public School', coords: { latitude: 12.9551, longitude: 77.6480 }, etaMinutes: 18, reached: false },
  ],
};

// Fleet mock — multiple buses for manager view
export const MOCK_FLEET: FleetBus[] = [
  {
    ...MOCK_BUS,
    activeParents: 34,
    tripId: 'trip_001',
  },
  {
    busId: 'bus_003',
    busNumber: '3',
    driverName: 'Suresh Kumar',
    driverPhone: '+91 98765 11111',
    routeName: 'Route B — Koramangala',
    coords: { latitude: 12.9352, longitude: 77.6245 },
    heading: 270,
    speedKmh: 32,
    status: 'on_route',
    etaMinutes: 7,
    nextStop: 'Forum Mall Signal',
    lastUpdated: Date.now(),
    stops: [],
    activeParents: 28,
    tripId: 'trip_002',
  },
  {
    busId: 'bus_012',
    busNumber: '12',
    driverName: 'Mohan Das',
    driverPhone: '+91 98765 22222',
    routeName: 'Route C — Whitefield',
    coords: { latitude: 12.9698, longitude: 77.7499 },
    heading: 90,
    speedKmh: 0,
    status: 'stopped',
    etaMinutes: 22,
    nextStop: 'ITPL Main Gate',
    lastUpdated: Date.now() - 90_000, // 90s ago
    stops: [],
    activeParents: 41,
    tripId: 'trip_003',
  },
];

// Simulate real-time position drift for demo purposes
export function simulateBusMovement(bus: BusState, tickMs = 5000): BusState {
  const drift = 0.0001 * (Math.random() - 0.5);
  return {
    ...bus,
    coords: {
      latitude:  bus.coords.latitude  + drift,
      longitude: bus.coords.longitude + drift,
    },
    lastUpdated: Date.now(),
  };
}
