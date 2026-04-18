import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import BroadcastScreen from '@app/(manager)/broadcast';

beforeEach(() => {
  const { routeClient } = jest.requireMock('@/api/route.client');
  routeClient.listRoutes.mockResolvedValue([
    { id: 'route_a', name: 'Route A — Indiranagar', isActive: true,  tenantId: 't1', createdAt: 0, updatedAt: 0 },
    { id: 'route_b', name: 'Route B — Koramangala', isActive: true,  tenantId: 't1', createdAt: 0, updatedAt: 0 },
    { id: 'route_c', name: 'Route C — Whitefield',  isActive: false, tenantId: 't1', createdAt: 0, updatedAt: 0 },
  ]);
});

describe('Manager Broadcast Screen', () => {
  it('renders "Broadcast" heading', () => {
    render(<BroadcastScreen />);
    expect(screen.getByText('Broadcast')).toBeTruthy();
  });

  it('renders "Send to" section', () => {
    render(<BroadcastScreen />);
    expect(screen.getAllByText(/send to/i).length).toBeGreaterThan(0);
  });

  it('renders "All routes" chip', () => {
    render(<BroadcastScreen />);
    expect(screen.getByText('All routes')).toBeTruthy();
  });

  it('renders route chips for active routes', async () => {
    render(<BroadcastScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Route A/)).toBeTruthy();
      expect(screen.getByText(/Route B/)).toBeTruthy();
    });
  });

  it('renders quick template buttons', () => {
    render(<BroadcastScreen />);
    expect(screen.getByText('Delay')).toBeTruthy();
    expect(screen.getByText('Route change')).toBeTruthy();
    expect(screen.getByText('Early arrival')).toBeTruthy();
    expect(screen.getByText('School notice')).toBeTruthy();
  });

  it('tapping a template fills the message input', () => {
    render(<BroadcastScreen />);
    fireEvent.press(screen.getByText('Delay'));
    const input = screen.getByPlaceholderText(/type your message/i);
    expect(input.props.value).toContain('running approximately 15 minutes late');
  });

  it('renders message text area', () => {
    render(<BroadcastScreen />);
    expect(screen.getByPlaceholderText(/type your message/i)).toBeTruthy();
  });

  it('renders Send button', () => {
    render(<BroadcastScreen />);
    expect(screen.getByText('Send to parents')).toBeTruthy();
  });

  it('shows character count', () => {
    render(<BroadcastScreen />);
    expect(screen.getByText(/\/ 280 characters/)).toBeTruthy();
  });

  it('shows sent confirmation after sending', async () => {
    jest.useFakeTimers();
    render(<BroadcastScreen />);

    // Select a route and fill message
    fireEvent.press(screen.getByText('All routes'));
    fireEvent.press(screen.getByText('Delay'));

    fireEvent.press(screen.getByText('Send to parents'));

    // Advance past the simulated send delay
    await waitFor(() => {
      jest.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText(/message sent/i)).toBeTruthy();
    });

    jest.useRealTimers();
  });
});
