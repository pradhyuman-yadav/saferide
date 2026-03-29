import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import ParentHistoryScreen from '@app/(parent)/history';
import { useAuthStore } from '@/store/auth.store';
import type { UserProfile } from '@/types/user';

const PARENT_PROFILE: UserProfile = {
  uid: 'p1', role: 'parent', name: 'Priya Sharma',
  tenantId: 'school_1', busId: 'bus_007',
  createdAt: Date.now(), updatedAt: Date.now(),
};

const NOW = 1742716320000; // fixed timestamp — 2025-03-23 07:52 UTC

jest.mock('@/api/trip.client', () => ({
  tripClient: {
    listTripsForBus: jest.fn().mockResolvedValue([
      {
        id: 'trip_001', tenantId: 'school_1', driverId: 'driver_1',
        busId: 'bus_007', routeId: 'route_a', status: 'ended',
        startedAt: NOW,
        endedAt:   NOW + 42 * 60_000,
        createdAt: NOW, updatedAt: NOW + 42 * 60_000,
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

describe('Parent History Screen', () => {
  it('renders "Trip history" heading', async () => {
    render(<ParentHistoryScreen />);
    await waitFor(() => expect(screen.getByText('Trip history')).toBeTruthy());
  });

  it('renders "Past trips" label', async () => {
    render(<ParentHistoryScreen />);
    await waitFor(() => expect(screen.getByText(/past trips/i)).toBeTruthy());
  });

  it('renders at least one trip card after loading', async () => {
    render(<ParentHistoryScreen />);
    await waitFor(() => {
      // SRBadge calls label.toUpperCase() so rendered text is 'COMPLETED'
      expect(screen.getAllByText(/COMPLETED/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('renders "Completed" status on trips with an end time', async () => {
    render(<ParentHistoryScreen />);
    await waitFor(() => {
      // SRBadge uppercases labels
      expect(screen.getByText('COMPLETED')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('renders the duration for a completed trip', async () => {
    render(<ParentHistoryScreen />);
    await waitFor(() => {
      expect(screen.getByText('42 min')).toBeTruthy();
    }, { timeout: 3000 });
  });
});
