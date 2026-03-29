import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import AdminRoutesScreen from '@app/(admin)/routes';

describe('Admin Routes Screen', () => {
  it('renders "Routes" heading', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText('Routes')).toBeTruthy();
  });

  it('renders "Fleet management" label', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText(/fleet management/i)).toBeTruthy();
  });

  it('renders Add route button', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText('Add route')).toBeTruthy();
  });

  it('renders all 4 mock routes', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText('Route A — Indiranagar')).toBeTruthy();
    expect(screen.getByText('Route B — Koramangala')).toBeTruthy();
    expect(screen.getByText('Route C — Whitefield')).toBeTruthy();
    expect(screen.getByText('Route D — HSR Layout')).toBeTruthy();
  });

  it('renders Active badge on active routes', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });

  it('renders Inactive badge on unassigned route', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText(/inactive/i)).toBeTruthy();
  });

  it('renders driver names on routes', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText(/Raju Sharma/)).toBeTruthy();
  });

  it('renders student counts', () => {
    render(<AdminRoutesScreen />);
    expect(screen.getByText(/34 students/)).toBeTruthy();
  });

  it('shows info alert when Add route is pressed', () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<AdminRoutesScreen />);
    fireEvent.press(screen.getByText('Add route'));
    expect(alertSpy).toHaveBeenCalled();
  });
});
