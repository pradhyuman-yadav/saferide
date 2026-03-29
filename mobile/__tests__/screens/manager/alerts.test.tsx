import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ManagerAlertsScreen from '@app/(manager)/alerts';

describe('Manager Alerts Screen', () => {
  it('renders "Alerts" heading', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText('Alerts')).toBeTruthy();
  });

  it('renders "Requires attention" label', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText(/requires attention/i)).toBeTruthy();
  });

  it('shows unresolved count badge', () => {
    render(<ManagerAlertsScreen />);
    // 2 unresolved in mock data
    expect(screen.getByText(/2 unresolved/i)).toBeTruthy();
  });

  it('renders speed violation alert', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText(/speed/i)).toBeTruthy();
    expect(screen.getByText(/72 km\/h/i)).toBeTruthy();
  });

  it('renders route deviation alert', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText(/600m off/i)).toBeTruthy();
  });

  it('renders SOS alert', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText(/SOS triggered/i)).toBeTruthy();
  });

  it('renders offline device alert', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText(/No GPS ping/i)).toBeTruthy();
  });

  it('renders "Resolved" badge on resolved alerts', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getAllByText(/resolved/i).length).toBeGreaterThan(0);
  });

  it('shows driver names on alerts', () => {
    render(<ManagerAlertsScreen />);
    expect(screen.getByText(/Raju Sharma/)).toBeTruthy();
    expect(screen.getByText(/Mohan Das/)).toBeTruthy();
  });
});
