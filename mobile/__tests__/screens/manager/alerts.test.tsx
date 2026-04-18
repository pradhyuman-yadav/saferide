import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import ManagerAlertsScreen from '@app/(manager)/alerts';

const BUSES = [
  { id: 'bus_007', registrationNumber: 'KA01AB1234', routeId: 'route_a', driverId: 'drv_1', status: 'active', tenantId: 't1', createdAt: 0, updatedAt: 0 },
  { id: 'bus_003', registrationNumber: 'KA01CD5678', routeId: 'route_b', driverId: 'drv_2', status: 'active', tenantId: 't1', createdAt: 0, updatedAt: 0 },
];

const DRIVERS = [
  { id: 'drv_1', name: 'Raju Sharma', phone: '+91 98765 43210', tenantId: 't1', createdAt: 0, updatedAt: 0 },
  { id: 'drv_2', name: 'Mohan Das',   phone: '+91 98765 22222', tenantId: 't1', createdAt: 0, updatedAt: 0 },
];

// bus_007: SOS active trip; bus_003: no trip → offline
const SOS_TRIP = {
  id: 'trip_001', status: 'active', busId: 'bus_007', routeId: 'route_a',
  driverId: 'drv_1', tenantId: 't1', sosActive: true, sosTriggeredAt: Date.now() - 60_000,
  startedAt: Date.now() - 3_600_000, createdAt: Date.now(), updatedAt: Date.now(),
};

beforeEach(() => {
  const { routeClient } = jest.requireMock('@/api/route.client');
  const { tripClient }  = jest.requireMock('@/api/trip.client');

  routeClient.listBuses.mockResolvedValue(BUSES);
  routeClient.listDrivers.mockResolvedValue(DRIVERS);
  tripClient.getActiveForBus = jest.fn().mockImplementation((busId: string) =>
    Promise.resolve(busId === 'bus_007' ? SOS_TRIP : null),
  );
});

describe('Manager Alerts Screen', () => {
  it('renders "Alerts" heading', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText('Alerts')).toBeTruthy();
  });

  it('renders "Requires attention" label', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText(/requires attention/i)).toBeTruthy();
  });

  it('renders SOS alert after loading', async () => {
    render(<ManagerAlertsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/SOS triggered/i)).toBeTruthy();
    });
  });

  it('renders offline alert for bus with no active trip', async () => {
    render(<ManagerAlertsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Bus has no active trip/i)).toBeTruthy();
    });
  });

  it('renders driver name on the SOS alert', async () => {
    render(<ManagerAlertsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Raju Sharma/)).toBeTruthy();
    });
  });

  it('renders driver name on the offline alert', async () => {
    render(<ManagerAlertsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Mohan Das/)).toBeTruthy();
    });
  });

  it('renders "SOS active" badge on the SOS alert', async () => {
    render(<ManagerAlertsScreen />);
    await waitFor(() => {
      // Both the header summary badge ("1 SOS ACTIVE") and the row badge ("SOS ACTIVE") match
      expect(screen.getAllByText(/SOS active/i).length).toBeGreaterThan(0);
    });
  });

  it('renders "offline" badge on offline alert', async () => {
    render(<ManagerAlertsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/offline/i)).toBeTruthy();
    });
  });
});
