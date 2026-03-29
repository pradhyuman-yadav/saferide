export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BusStop {
  id: string;
  name: string;
  coords: Coordinates;
  etaMinutes: number;
  reached: boolean;
}

export interface BusState {
  busId: string;
  busNumber: string;
  driverName: string;
  driverPhone: string;
  routeName: string;
  coords: Coordinates;
  heading: number;        // degrees 0-360
  speedKmh: number;
  status: 'on_route' | 'delayed' | 'stopped' | 'offline';
  etaMinutes: number;     // to parent's stop
  nextStop: string;
  stops: BusStop[];
  lastUpdated: number;    // Unix ms
}

export interface FleetBus extends BusState {
  activeParents: number;
  tripId: string;
}
