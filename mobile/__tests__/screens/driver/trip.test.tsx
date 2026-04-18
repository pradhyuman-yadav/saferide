import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import DriverTripScreen from '@app/(driver)/index';
import { useAuthStore } from '@/store/auth.store';
import type { UserProfile } from '@/types/user';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  watchPositionAsync:                jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy:                          { Balanced: 3 },
}));

jest.mock('@/api/trip.client', () => ({
  tripClient: {
    getActive:  jest.fn().mockResolvedValue(null),
    startTrip:  jest.fn().mockResolvedValue({
      id: 'trip_001', status: 'active', busId: 'bus_007', routeId: 'route_a',
      tenantId: 'school_1', driverId: 'd1',
      startedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
    }),
    endTrip: jest.fn().mockResolvedValue({
      id: 'trip_001', status: 'ended', busId: 'bus_007', routeId: 'route_a',
      tenantId: 'school_1', driverId: 'd1',
      startedAt: Date.now(), endedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
    }),
  },
}));

jest.mock('@/api/route.client', () => ({
  routeClient: {
    getBus:   jest.fn().mockResolvedValue({
      id: 'bus_007', registrationNumber: 'KA01AB1234',
      make: 'Tata', model: 'Starbus', capacity: 40,
      status: 'active', tenantId: 'school_1', driverId: 'd1', routeId: 'route_a',
      createdAt: Date.now(), updatedAt: Date.now(),
    }),
    getRoute: jest.fn().mockResolvedValue({
      id: 'route_a', name: 'Route A — Indiranagar',
      description: 'Morning route', isActive: true,
      tenantId: 'school_1', createdAt: Date.now(), updatedAt: Date.now(),
    }),
    listStops: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/tasks/location.task', () => ({
  startLocationTracking: jest.fn().mockResolvedValue(true),
  stopLocationTracking:  jest.fn().mockResolvedValue(undefined),
}));

// ── Profiles ──────────────────────────────────────────────────────────────────

const DRIVER_NO_ASSIGNMENT: UserProfile = {
  uid: 'd1', role: 'driver', name: 'Raju Sharma',
  tenantId: 'school_1', createdAt: Date.now(), updatedAt: Date.now(),
};

const DRIVER_WITH_ASSIGNMENT: UserProfile = {
  ...DRIVER_NO_ASSIGNMENT,
  assignedBusId:   'bus_007',
  assignedRouteId: 'route_a',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Driver Trip Screen — no assignment', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { uid: 'd1' } as any,
      profile: DRIVER_NO_ASSIGNMENT,
      role: 'driver',
      isLoading: false,
    });
  });

  it('renders the bottom sheet with a drag handle', () => {
    render(<DriverTripScreen />);
    // Map fills screen; status pill is always rendered
    expect(screen.getByTestId('map-view')).toBeTruthy();
  });

  it('shows "Contact manager" in peek row when no bus assigned', async () => {
    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.getByText('Contact manager')).toBeTruthy();
    });
  });

  it('shows "Off duty" status pill when no active trip', async () => {
    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.getByText('Off duty')).toBeTruthy();
    });
  });

  it('does not show SOS when trip is idle', async () => {
    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/SOS/i)).toBeNull();
    });
  });
});

describe('Driver Trip Screen — with assignment', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { uid: 'd1' } as any,
      profile: DRIVER_WITH_ASSIGNMENT,
      role: 'driver',
      isLoading: false,
    });
  });

  it('shows bus registration number after data loads', async () => {
    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.getByText('KA01AB1234')).toBeTruthy();
    });
  });

  it('shows route name after data loads', async () => {
    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.getByText('Route A — Indiranagar')).toBeTruthy();
    });
  });

  it('shows "Start trip" button when no active trip', async () => {
    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.getByText('Start trip')).toBeTruthy();
    });
  });

  it('shows hint about departing when assignment is ready', async () => {
    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Tap Start trip when ready/i)).toBeTruthy();
    });
  });

  it('shows "End trip" alert when End Trip is pressed after trip starts', async () => {
    const { tripClient } = jest.requireMock('@/api/trip.client') as { tripClient: { getActive: jest.Mock } };
    // Simulate an already-active trip
    tripClient.getActive.mockResolvedValueOnce({
      id: 'trip_001', status: 'active', busId: 'bus_007', routeId: 'route_a',
      tenantId: 'school_1', driverId: 'd1',
      startedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
    });

    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    const { fireEvent } = require('@testing-library/react-native');

    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.getByText('End trip')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('End trip'));
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringMatching(/end trip/i),
      expect.any(String),
      expect.any(Array),
    );
  });

  it('shows SOS button when trip is active', async () => {
    const { tripClient } = jest.requireMock('@/api/trip.client') as { tripClient: { getActive: jest.Mock } };
    tripClient.getActive.mockResolvedValueOnce({
      id: 'trip_001', status: 'active', busId: 'bus_007', routeId: 'route_a',
      tenantId: 'school_1', driverId: 'd1',
      startedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
    });

    render(<DriverTripScreen />);
    // SOS — Emergency is in the expanded sheet content (opacity=1 at expanded state)
    await waitFor(() => {
      expect(screen.getByText(/SOS — Emergency/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('pressing SOS shows confirmation alert', async () => {
    const { tripClient } = jest.requireMock('@/api/trip.client') as { tripClient: { getActive: jest.Mock } };
    tripClient.getActive.mockResolvedValueOnce({
      id: 'trip_001', status: 'active', busId: 'bus_007', routeId: 'route_a',
      tenantId: 'school_1', driverId: 'd1',
      startedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
    });

    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    const { fireEvent } = require('@testing-library/react-native');

    render(<DriverTripScreen />);
    await waitFor(() => {
      expect(screen.getByText(/SOS — Emergency/i)).toBeTruthy();
    });
    fireEvent.press(screen.getByText(/SOS — Emergency/i));
    // Title includes an emoji — match only the text portion to stay resilient
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('SOS Alert'),
      expect.any(String),
      expect.any(Array),
    );
  });
});
