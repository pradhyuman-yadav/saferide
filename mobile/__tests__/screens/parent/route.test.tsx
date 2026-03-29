import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import RouteScreen from '@app/(parent)/route';
import { useAuthStore } from '@/store/auth.store';
import type { UserProfile } from '@/types/user';
import type { LiveLocation } from '@/hooks/useLiveTrack';

const PARENT_PROFILE: UserProfile = {
  uid: 'p1', role: 'parent', name: 'Priya Sharma',
  tenantId: 'school_1', busId: '7',
  createdAt: Date.now(), updatedAt: Date.now(),
};

const MOCK_LOCATION: LiveLocation = {
  tripId: 'trip_001',
  lat: 12.9784, lon: 77.6408,
  speed: 35, heading: 135, accuracy: 5,
  recordedAt: Date.now() - 2000,
  updatedAt: Date.now(),
};

// ── Mocks ──────────────────────────────────────────────────────────────────────
// All timestamps inlined inside factories to avoid babel-plugin-jest-hoist TDZ issues.

jest.mock('@/hooks/useLiveTrack', () => ({
  useLiveTrack: () => ({ location: MOCK_LOCATION, isConnected: true }),
}));

jest.mock('@/api/route.client', () => ({
  routeClient: {
    getBus: jest.fn().mockResolvedValue({
      id: '7', tenantId: 'school_1', registrationNumber: 'KA01AB0007',
      make: 'Tata', model: 'Starbus', capacity: 40,
      status: 'active', routeId: 'route_a', driverId: 'driver_1',
      createdAt: Date.now(), updatedAt: Date.now(),
    }),
    getRoute: jest.fn().mockResolvedValue({
      id: 'route_a', tenantId: 'school_1', name: 'Route A — Morning Run',
      description: null, isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
    }),
    listStops: jest.fn().mockResolvedValue([
      { id: 's1', tenantId: 'school_1', routeId: 'route_a', name: 'Indiranagar 5th Cross',   sequence: 1, lat: 12.97, lon: 77.63, estimatedOffsetMinutes: 0,  createdAt: Date.now(), updatedAt: Date.now() },
      { id: 's2', tenantId: 'school_1', routeId: 'route_a', name: 'CMH Road Gate',            sequence: 2, lat: 12.98, lon: 77.64, estimatedOffsetMinutes: 5,  createdAt: Date.now(), updatedAt: Date.now() },
      { id: 's3', tenantId: 'school_1', routeId: 'route_a', name: 'Kalyan Nagar Park',        sequence: 3, lat: 12.99, lon: 77.65, estimatedOffsetMinutes: 15, createdAt: Date.now(), updatedAt: Date.now() },
      { id: 's4', tenantId: 'school_1', routeId: 'route_a', name: 'Delhi Public School Gate', sequence: 4, lat: 13.00, lon: 77.66, estimatedOffsetMinutes: 25, createdAt: Date.now(), updatedAt: Date.now() },
    ]),
    getDriver: jest.fn().mockResolvedValue({
      id: 'driver_1', tenantId: 'school_1', firebaseUid: 'uid_d1',
      email: 'raju@example.com', name: 'Raju Sharma', phone: '9999999999',
      licenseNumber: 'KA0120230001', busId: '7', isActive: true,
      createdAt: Date.now(), updatedAt: Date.now(),
    }),
  },
}));

jest.mock('@/api/trip.client', () => ({
  tripClient: {
    getActiveForBus: jest.fn().mockResolvedValue({
      id: 'trip_001', tenantId: 'school_1', driverId: 'driver_1',
      busId: '7', routeId: 'route_a', status: 'active',
      // Trip started 4 minutes ago — first stop (offset 0) is reached; others still upcoming
      startedAt: Date.now() - 4 * 60_000,
      createdAt: Date.now(), updatedAt: Date.now(),
    }),
  },
}));

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'p1' } as any,
    profile: PARENT_PROFILE,
    role: 'parent',
    isLoading: false,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Parent Route Screen', () => {
  it('renders "Route overview" label', async () => {
    render(<RouteScreen />);
    await waitFor(() => expect(screen.getByText(/route overview/i)).toBeTruthy());
  });

  it('renders the route name after data loads', async () => {
    render(<RouteScreen />);
    await waitFor(() => {
      expect(screen.getByText('Route A — Morning Run')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('renders driver name after data loads', async () => {
    render(<RouteScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Raju Sharma/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('renders stop names in the list after data loads', async () => {
    render(<RouteScreen />);
    await waitFor(() => {
      expect(screen.getByText('Kalyan Nagar Park')).toBeTruthy();
      expect(screen.getByText('Delhi Public School Gate')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows "Next stop" badge on the first upcoming stop', async () => {
    render(<RouteScreen />);
    await waitFor(() => {
      expect(screen.getByText(/next stop/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows speed badge when bus is moving', async () => {
    render(<RouteScreen />);
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`${Math.round(MOCK_LOCATION.speed!)}`))).toBeTruthy()
    );
  });
});
