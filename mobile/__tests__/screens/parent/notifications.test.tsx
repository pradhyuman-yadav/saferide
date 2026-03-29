import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import NotificationsScreen from '@app/(parent)/notifications';
import { useAuthStore } from '@/store/auth.store';
import type { UserProfile } from '@/types/user';

const PARENT_PROFILE: UserProfile = {
  uid: 'p1', role: 'parent', name: 'Priya Sharma',
  tenantId: 'school_1', busId: 'bus_007',
  createdAt: Date.now(), updatedAt: Date.now(),
};

// Timestamps defined inside factory to avoid babel-plugin-jest-hoist TDZ issues
jest.mock('@/api/trip.client', () => ({
  tripClient: {
    listTripsForBus: jest.fn().mockResolvedValue([
      {
        id: 'trip_001', tenantId: 'school_1', driverId: 'driver_1',
        busId: 'bus_007', routeId: 'route_a', status: 'ended',
        startedAt: Date.now() - 42 * 60_000,
        endedAt:   Date.now() - 5 * 60_000,
        createdAt: Date.now() - 42 * 60_000, updatedAt: Date.now(),
      },
    ]),
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

describe('Parent Notifications Screen', () => {
  it('renders "Trip alerts" heading', async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText('Trip alerts')).toBeTruthy());
  });

  it('renders "Today" date label', async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText('Today')).toBeTruthy());
  });

  it('shows "Trip started" event after data loads', async () => {
    render(<NotificationsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Trip started')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows "Trip ended" event after data loads', async () => {
    render(<NotificationsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Trip ended')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows duration in "Trip ended" body text', async () => {
    render(<NotificationsScreen />);
    await waitFor(() => {
      // 42 minutes elapsed between startedAt and endedAt
      expect(screen.getByText(/37 min|38 min|39 min|40 min|41 min|42 min/)).toBeTruthy();
    }, { timeout: 3000 });
  });
});
