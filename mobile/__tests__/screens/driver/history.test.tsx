import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import DriverHistoryScreen from '@app/(driver)/history';

// ── Mock trip data (defined inside factory to avoid jest.mock hoisting TDZ) ──

const NOW    = 1742716320000; // 2025-03-23 07:52 UTC — fixed timestamp
const MINUTE = 60_000;

jest.mock('@/api/trip.client', () => ({
  tripClient: {
    listMyTrips: jest.fn().mockResolvedValue([
      // Completed trip — 42 minutes duration
      {
        id: 'trip_001', tenantId: 'school_1', driverId: 'd1',
        busId: 'bus_007', routeId: 'route_a', status: 'ended',
        startedAt: 1742716320000,
        endedAt:   1742716320000 + 42 * 60_000,
        latestSpeed: 48,
        createdAt: 1742716320000,
        updatedAt: 1742716320000 + 42 * 60_000,
      },
    ]),
    getActive: jest.fn().mockResolvedValue(null),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Driver History Screen', () => {
  it('renders "Trip history" heading', () => {
    render(<DriverHistoryScreen />);
    expect(screen.getByText('Trip history')).toBeTruthy();
  });

  it('renders "Past trips" label', () => {
    render(<DriverHistoryScreen />);
    expect(screen.getByText(/past trips/i)).toBeTruthy();
  });

  it('renders at least one trip card after loading', async () => {
    render(<DriverHistoryScreen />);
    await waitFor(() => {
      // formatDate uses toLocaleDateString — locale-independent check
      expect(screen.getAllByText(/Completed/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('renders "Completed" status on trips with an end time', async () => {
    render(<DriverHistoryScreen />);
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('renders the duration for a completed trip', async () => {
    render(<DriverHistoryScreen />);
    await waitFor(() => {
      expect(screen.getByText('42 min')).toBeTruthy();
    }, { timeout: 3000 });
  });
});
