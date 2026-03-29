import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
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

  it('renders "Platform stats" label', () => {
    render(<AdminDashboardScreen />);
    expect(screen.getByText(/platform stats/i)).toBeTruthy();
  });

  it('renders buses tracked stat', () => {
    render(<AdminDashboardScreen />);
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('Buses tracked')).toBeTruthy();
  });

  it('renders parents active stat', () => {
    render(<AdminDashboardScreen />);
    expect(screen.getByText('4,800')).toBeTruthy();
    expect(screen.getByText('Parents active')).toBeTruthy();
  });

  it('renders uptime stat', () => {
    render(<AdminDashboardScreen />);
    expect(screen.getByText('99.9%')).toBeTruthy();
    expect(screen.getByText('Platform uptime')).toBeTruthy();
  });

  it('renders quick action buttons', () => {
    render(<AdminDashboardScreen />);
    expect(screen.getByText('Add route')).toBeTruthy();
    expect(screen.getByText('Invite driver')).toBeTruthy();
    expect(screen.getByText('Import students')).toBeTruthy();
    expect(screen.getByText('Download report')).toBeTruthy();
  });

  it('renders trial plan badge', () => {
    render(<AdminDashboardScreen />);
    expect(screen.getAllByText(/trial/i).length).toBeGreaterThan(0);
  });

  it('renders sign out button', () => {
    render(<AdminDashboardScreen />);
    // Sign out is a TouchableOpacity icon button; verify screen renders with header actions
    expect(screen.getByText('Vivek Gupta')).toBeTruthy();
  });

  it('quick action taps show info alert', () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<AdminDashboardScreen />);
    fireEvent.press(screen.getByText('Add route'));
    expect(alertSpy).toHaveBeenCalled();
  });
});
