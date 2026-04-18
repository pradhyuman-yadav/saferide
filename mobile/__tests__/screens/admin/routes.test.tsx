import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AdminRoutesScreen from '@app/(admin)/routes';

const ROUTES = [
  { id: 'route_a', name: 'Route A — Indiranagar', isActive: true,  tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  { id: 'route_b', name: 'Route B — Koramangala', isActive: true,  tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  { id: 'route_c', name: 'Route C — Whitefield',  isActive: true,  tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  { id: 'route_d', name: 'Route D — HSR Layout',  isActive: false, tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
];

const BUSES = [
  { id: 'bus_1', registrationNumber: 'KA01AB1234', routeId: 'route_a', driverId: 'drv_1', tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  { id: 'bus_2', registrationNumber: 'KA01CD5678', routeId: 'route_b', driverId: 'drv_2', tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
];

const DRIVERS = [
  { id: 'drv_1', name: 'Raju Sharma',  phone: '+91 98765 43210', tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  { id: 'drv_2', name: 'Suresh Kumar', phone: '+91 98765 11111', tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
];

beforeEach(() => {
  const { routeClient } = jest.requireMock('@/api/route.client');
  routeClient.listRoutes.mockResolvedValue(ROUTES);
  routeClient.listBuses.mockResolvedValue(BUSES);
  routeClient.listDrivers.mockResolvedValue(DRIVERS);
});

describe('Admin Routes Screen', () => {
  it('renders "Routes" heading', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText('Routes')).toBeTruthy();
  });

  it('renders "Fleet management" label', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText(/fleet management/i)).toBeTruthy();
  });

  it('renders Add route button after loading', async () => {
    render(<AdminRoutesScreen />);
    await waitFor(() => expect(screen.getByText('Add route')).toBeTruthy());
  });

  it('renders all 4 routes after loading', async () => {
    render(<AdminRoutesScreen />);
    await waitFor(() => {
      expect(screen.getByText('Route A — Indiranagar')).toBeTruthy();
      expect(screen.getByText('Route B — Koramangala')).toBeTruthy();
      expect(screen.getByText('Route C — Whitefield')).toBeTruthy();
      expect(screen.getByText('Route D — HSR Layout')).toBeTruthy();
    });
  });

  it('renders Active badge on active routes', async () => {
    render(<AdminRoutesScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
    });
  });

  it('renders Inactive badge on inactive route', async () => {
    render(<AdminRoutesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/inactive/i)).toBeTruthy();
    });
  });

  it('renders driver names on assigned routes', async () => {
    render(<AdminRoutesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Raju Sharma/)).toBeTruthy();
    });
  });

  it('shows info alert when Add route is pressed', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<AdminRoutesScreen />);
    await waitFor(() => expect(screen.getByText('Add route')).toBeTruthy());
    fireEvent.press(screen.getByText('Add route'));
    expect(alertSpy).toHaveBeenCalled();
  });
});
