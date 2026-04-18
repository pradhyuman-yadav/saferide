import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import ManagerFleetScreen from '@app/(manager)/index';

// Per-test mock data — matches the FleetEntry shape built by useFleet()
const BUSES = [
  { id: 'bus_007', regNumber: 'KA01AB1234', routeId: 'route_a', driverId: 'drv_1', tenantId: 't1', createdAt: 0, updatedAt: 0 },
  { id: 'bus_003', regNumber: 'KA01CD5678', routeId: 'route_b', driverId: 'drv_2', tenantId: 't1', createdAt: 0, updatedAt: 0 },
  { id: 'bus_012', regNumber: 'KA01EF9012', routeId: 'route_c', driverId: 'drv_3', tenantId: 't1', createdAt: 0, updatedAt: 0 },
];

const DRIVERS = [
  { id: 'drv_1', name: 'Raju Sharma',   phone: '+91 98765 43210', tenantId: 't1', createdAt: 0, updatedAt: 0 },
  { id: 'drv_2', name: 'Suresh Kumar',  phone: '+91 98765 11111', tenantId: 't1', createdAt: 0, updatedAt: 0 },
  { id: 'drv_3', name: 'Mohan Das',     phone: '+91 98765 22222', tenantId: 't1', createdAt: 0, updatedAt: 0 },
];

const ROUTES = [
  { id: 'route_a', name: 'Route A — Indiranagar', tenantId: 't1', createdAt: 0, updatedAt: 0 },
  { id: 'route_b', name: 'Route B — Koramangala', tenantId: 't1', createdAt: 0, updatedAt: 0 },
  { id: 'route_c', name: 'Route C — Whitefield',  tenantId: 't1', createdAt: 0, updatedAt: 0 },
];

const ACTIVE_TRIP = {
  id: 'trip_001', status: 'active', busId: 'bus_007', routeId: 'route_a',
  driverId: 'drv_1', tenantId: 't1', startedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
};

beforeEach(() => {
  const { routeClient } = jest.requireMock('@/api/route.client');
  const { tripClient }  = jest.requireMock('@/api/trip.client');

  routeClient.listBuses.mockResolvedValue(BUSES);
  routeClient.listDrivers.mockResolvedValue(DRIVERS);
  routeClient.listRoutes.mockResolvedValue(ROUTES);
  // bus_007 has an active trip; others do not
  tripClient.getActiveForBus = jest.fn().mockImplementation((busId: string) =>
    Promise.resolve(busId === 'bus_007' ? ACTIVE_TRIP : null),
  );
});

describe('Manager Fleet Screen', () => {
  it('renders "Fleet overview" label', async () => {
    render(<ManagerFleetScreen />);
    await waitFor(() => expect(screen.getByText(/fleet overview/i)).toBeTruthy());
  });

  it('renders "All buses" heading', async () => {
    render(<ManagerFleetScreen />);
    await waitFor(() => expect(screen.getByText('All buses')).toBeTruthy());
  });

  it('renders all fleet buses by driver name', async () => {
    render(<ManagerFleetScreen />);
    await waitFor(() => {
      DRIVERS.forEach((d) => expect(screen.getByText(d.name)).toBeTruthy());
    });
  });

  it('shows active bus count pill', async () => {
    render(<ManagerFleetScreen />);
    await waitFor(() => expect(screen.getByText('1 active')).toBeTruthy());
  });

  it('shows total bus count pill', async () => {
    render(<ManagerFleetScreen />);
    await waitFor(() => expect(screen.getByText(`${BUSES.length} total`)).toBeTruthy());
  });

  it('renders route name for each bus', async () => {
    render(<ManagerFleetScreen />);
    await waitFor(() => {
      ROUTES.forEach((r) => expect(screen.getByText(r.name)).toBeTruthy());
    });
  });

  it('renders status badge for each bus', async () => {
    render(<ManagerFleetScreen />);
    await waitFor(() =>
      expect(screen.getAllByText(/on route|stopped|delayed|offline/i).length).toBeGreaterThan(0),
    );
  });
});
