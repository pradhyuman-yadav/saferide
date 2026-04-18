import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AdminDashboardScreen from '@app/(admin)/index';
import { useAuthStore } from '@/store/auth.store';
import type { UserProfile } from '@/types/user';

const ADMIN_PROFILE: UserProfile = {
  uid: 'a1', role: 'school_admin', name: 'Vivek Gupta',
  email: 'vivek@school.in', tenantId: 'school_1',
  schoolName: 'Delhi Public School',
  createdAt: Date.now(), updatedAt: Date.now(),
};

beforeEach(() => {
  useAuthStore.setState({ user: { uid: 'a1' } as any, profile: ADMIN_PROFILE, role: 'school_admin', isLoading: false });

  const { routeClient } = jest.requireMock('@/api/route.client');
  routeClient.listBuses.mockResolvedValue([
    { id: 'bus_1', registrationNumber: 'KA01AB1234', routeId: 'route_a', driverId: 'drv_1', tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
    { id: 'bus_2', registrationNumber: 'KA01CD5678', routeId: 'route_b', driverId: 'drv_2', tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  ]);
  routeClient.listDrivers.mockResolvedValue([
    { id: 'drv_1', name: 'Raju Sharma',  phone: '+91 98765 43210', tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
    { id: 'drv_2', name: 'Suresh Kumar', phone: '+91 98765 11111', tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  ]);
  routeClient.listRoutes.mockResolvedValue([
    { id: 'route_a', name: 'Route A — Indiranagar', isActive: true,  tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
    { id: 'route_b', name: 'Route B — Koramangala', isActive: false, tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  ]);
});

describe('Admin Dashboard Screen', () => {
  it('renders admin name in header', () => {
    render(<AdminDashboardScreen />);
    expect(screen.getByText('Vivek Gupta')).toBeTruthy();
  });

  it('renders school name in header', () => {
    render(<AdminDashboardScreen />);
    expect(screen.getByText('Delhi Public School')).toBeTruthy();
  });

  it('renders bus count stat card', async () => {
    render(<AdminDashboardScreen />);
    await waitFor(() => {
      // 2 buses and 2 drivers — both show "2"
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      expect(screen.getByText('Buses')).toBeTruthy();
    });
  });

  it('renders driver count stat card', async () => {
    render(<AdminDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Drivers')).toBeTruthy());
  });

  it('renders routes stat cards', async () => {
    render(<AdminDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Routes')).toBeTruthy();
      expect(screen.getByText('Active routes')).toBeTruthy();
    });
  });

  it('renders quick action buttons', async () => {
    render(<AdminDashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Add route')).toBeTruthy();
      expect(screen.getByText('Invite driver')).toBeTruthy();
      expect(screen.getByText('Import students')).toBeTruthy();
      expect(screen.getByText('Download report')).toBeTruthy();
    });
  });

  it('quick action taps show info alert', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<AdminDashboardScreen />);
    await waitFor(() => expect(screen.getByText('Add route')).toBeTruthy());
    fireEvent.press(screen.getByText('Add route'));
    expect(alertSpy).toHaveBeenCalled();
  });
});
