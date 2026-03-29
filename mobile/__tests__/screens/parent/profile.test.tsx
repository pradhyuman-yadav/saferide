import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ProfileScreen from '@app/(parent)/profile';
import { useAuthStore } from '@/store/auth.store';
import type { UserProfile } from '@/types/user';

const MOCK_PROFILE: UserProfile = {
  uid:           'u1',
  role:          'parent',
  name:          'Priya Sharma',
  email:         'priya@example.com',
  tenantId:      'school_1',
  childName:     'Arjun',
  childClass:    'Class 3',
  busId:         '7',
  preferredLanguage: 'English',
  createdAt:     Date.now(),
  updatedAt:     Date.now(),
};

beforeEach(() => {
  useAuthStore.setState({ user: { uid: 'u1' } as any, profile: MOCK_PROFILE, role: 'parent', isLoading: false });
});

describe('Parent Profile Screen', () => {
  it('renders the parent name', () => {
    render(<ProfileScreen />);
    // Name appears in the header and in the Account info row
    expect(screen.getAllByText('Priya Sharma').length).toBeGreaterThan(0);
  });

  it('renders the parent email', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('priya@example.com')).toBeTruthy();
  });

  it('renders child name', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Arjun')).toBeTruthy();
  });

  it('renders child class', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Class 3')).toBeTruthy();
  });

  it('renders bus assignment', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Bus 7')).toBeTruthy();
  });

  it('renders notification preferences section', () => {
    render(<ProfileScreen />);
    expect(screen.getByText(/notifications/i)).toBeTruthy();
    expect(screen.getByText('Bus departed')).toBeTruthy();
    expect(screen.getByText('10 minutes away')).toBeTruthy();
  });

  it('renders language preference', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('renders Sign out button', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  it('Sign out button triggers confirmation alert', () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Sign out'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Sign out',
      expect.any(String),
      expect.any(Array),
    );
  });
});
