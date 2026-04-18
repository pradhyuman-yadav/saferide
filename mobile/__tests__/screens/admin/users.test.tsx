import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AdminUsersScreen from '@app/(admin)/users';

const DRIVERS = [
  { id: 'drv_1', name: 'Raju Sharma',  phone: '+91 98765 43210', email: undefined,            isActive: true,  tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  { id: 'drv_2', name: 'Suresh Kumar', phone: '+91 98765 11111', email: undefined,            isActive: true,  tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
  { id: 'drv_3', name: 'Mohan Das',    phone: undefined,         email: 'mohan@school.co.in', isActive: false, tenantId: 'school_1', createdAt: 0, updatedAt: 0 },
];

beforeEach(() => {
  const { routeClient } = jest.requireMock('@/api/route.client');
  routeClient.listDrivers.mockResolvedValue(DRIVERS);
});

describe('Admin Users Screen', () => {
  it('renders "Users" heading', () => {
    render(<AdminUsersScreen />);
    expect(screen.getByText('Users')).toBeTruthy();
  });

  it('renders "User management" label', () => {
    render(<AdminUsersScreen />);
    expect(screen.getByText(/user management/i)).toBeTruthy();
  });

  it('renders Invite button', () => {
    render(<AdminUsersScreen />);
    expect(screen.getByText('Invite')).toBeTruthy();
  });

  it('renders filter tabs for all roles', () => {
    render(<AdminUsersScreen />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Parents')).toBeTruthy();
    expect(screen.getByText('Drivers')).toBeTruthy();
    expect(screen.getByText('Managers')).toBeTruthy();
    expect(screen.getByText('Admins')).toBeTruthy();
  });

  it('renders driver names in the All tab after loading', async () => {
    render(<AdminUsersScreen />);
    await waitFor(() => {
      expect(screen.getByText('Raju Sharma')).toBeTruthy();
      expect(screen.getByText('Suresh Kumar')).toBeTruthy();
    });
  });

  it('renders driver names in the Drivers tab', async () => {
    render(<AdminUsersScreen />);
    fireEvent.press(screen.getByText('Drivers'));
    await waitFor(() => {
      expect(screen.getByText('Raju Sharma')).toBeTruthy();
      expect(screen.getByText('Suresh Kumar')).toBeTruthy();
    });
  });

  it('shows web-only message when Parents tab is pressed', async () => {
    render(<AdminUsersScreen />);
    fireEvent.press(screen.getByText('Parents'));
    await waitFor(() => {
      expect(screen.getByText(/web portal/i)).toBeTruthy();
    });
  });

  it('shows web-only message when Admins tab is pressed', async () => {
    render(<AdminUsersScreen />);
    fireEvent.press(screen.getByText('Admins'));
    await waitFor(() => {
      expect(screen.getByText(/web portal/i)).toBeTruthy();
    });
  });

  it('returns to driver list when All tab is re-pressed', async () => {
    render(<AdminUsersScreen />);
    fireEvent.press(screen.getByText('Parents'));
    fireEvent.press(screen.getByText('All'));
    await waitFor(() => {
      expect(screen.getByText('Raju Sharma')).toBeTruthy();
    });
  });

  it('renders Driver role badge on each driver', async () => {
    render(<AdminUsersScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/driver/i).length).toBeGreaterThan(0);
    });
  });

  it('renders phone number for drivers that have one', async () => {
    render(<AdminUsersScreen />);
    await waitFor(() => {
      expect(screen.getByText('+91 98765 43210')).toBeTruthy();
    });
  });
});
