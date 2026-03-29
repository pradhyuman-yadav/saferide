import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import AdminUsersScreen from '@app/(admin)/users';

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

  it('renders all users by default (All tab)', () => {
    render(<AdminUsersScreen />);
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('Raju Sharma')).toBeTruthy();
    expect(screen.getByText('Ramesh Nair')).toBeTruthy();
    expect(screen.getByText('Vivek Gupta')).toBeTruthy();
  });

  it('filters to drivers only when Drivers tab is pressed', () => {
    render(<AdminUsersScreen />);
    fireEvent.press(screen.getByText('Drivers'));
    // Drivers should be visible
    expect(screen.getByText('Raju Sharma')).toBeTruthy();
    expect(screen.getByText('Suresh Kumar')).toBeTruthy();
    // Parent should not be visible
    expect(screen.queryByText('Priya Sharma')).toBeNull();
  });

  it('filters to parents only when Parents tab is pressed', () => {
    render(<AdminUsersScreen />);
    fireEvent.press(screen.getByText('Parents'));
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.queryByText('Raju Sharma')).toBeNull();
  });

  it('filters to admins when Admins tab is pressed', () => {
    render(<AdminUsersScreen />);
    fireEvent.press(screen.getByText('Admins'));
    expect(screen.getByText('Vivek Gupta')).toBeTruthy();
    expect(screen.queryByText('Priya Sharma')).toBeNull();
  });

  it('returns to all users when All tab is re-pressed', () => {
    render(<AdminUsersScreen />);
    fireEvent.press(screen.getByText('Drivers'));
    fireEvent.press(screen.getByText('All'));
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('Raju Sharma')).toBeTruthy();
  });

  it('renders role badge on each user', () => {
    render(<AdminUsersScreen />);
    expect(screen.getAllByText(/parent|driver|manager|admin/i).length).toBeGreaterThan(0);
  });

  it('renders contact info for users', () => {
    render(<AdminUsersScreen />);
    expect(screen.getByText('+91 98765 01001')).toBeTruthy();
  });
});
