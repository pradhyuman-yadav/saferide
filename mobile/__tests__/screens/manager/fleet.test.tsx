import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ManagerFleetScreen from '@app/(manager)/index';
import { MOCK_FLEET } from '../../fixtures/bus.fixture';

describe('Manager Fleet Screen', () => {
  it('renders "Fleet overview" label', () => {
    render(<ManagerFleetScreen />);
    expect(screen.getByText(/fleet overview/i)).toBeTruthy();
  });

  it('renders "All buses" heading', () => {
    render(<ManagerFleetScreen />);
    expect(screen.getByText('All buses')).toBeTruthy();
  });

  it('renders all fleet buses', () => {
    render(<ManagerFleetScreen />);
    MOCK_FLEET.forEach((bus) => {
      expect(screen.getByText(bus.driverName)).toBeTruthy();
    });
  });

  it('shows active bus count pill', () => {
    render(<ManagerFleetScreen />);
    const active = MOCK_FLEET.filter((b) => b.status === 'on_route').length;
    expect(screen.getByText(`${active} active`)).toBeTruthy();
  });

  it('shows stopped bus count pill', () => {
    render(<ManagerFleetScreen />);
    const stopped = MOCK_FLEET.filter((b) => b.status === 'stopped').length;
    expect(screen.getByText(`${stopped} stopped`)).toBeTruthy();
  });

  it('shows total bus count pill', () => {
    render(<ManagerFleetScreen />);
    expect(screen.getByText(`${MOCK_FLEET.length} total`)).toBeTruthy();
  });

  it('renders route name for each bus', () => {
    render(<ManagerFleetScreen />);
    MOCK_FLEET.forEach((bus) => {
      expect(screen.getByText(bus.routeName)).toBeTruthy();
    });
  });

  it('renders speed for each bus', () => {
    render(<ManagerFleetScreen />);
    MOCK_FLEET.forEach((bus) => {
      expect(screen.getByText(`${bus.speedKmh} km/h`)).toBeTruthy();
    });
  });

  it('renders status badge for each bus', () => {
    render(<ManagerFleetScreen />);
    expect(screen.getAllByText(/on route|stopped|delayed|offline/i).length).toBeGreaterThan(0);
  });
});
