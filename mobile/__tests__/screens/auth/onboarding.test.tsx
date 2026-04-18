import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import OnboardingScreen from '@app/(auth)/onboarding';
import { useAuthStore } from '@/store/auth.store';

const mockSignOut = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  Redirect: () => null,
  Stack: () => null,
  Link: () => null,
}));

beforeEach(() => {
  useAuthStore.setState({
    user:      { uid: 'user_123' } as any,
    profile:   null,
    role:      null,
    isLoading: false,
    signOut:   mockSignOut,
  } as any);
  mockSignOut.mockClear();
});

describe('OnboardingScreen', () => {
  it('renders the "Account not ready" eyebrow', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText('Account not ready')).toBeTruthy();
  });

  it('renders the main heading', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText("Your school hasn't added you yet.")).toBeTruthy();
  });

  it('renders the body with instructions', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText(/transport manager/i)).toBeTruthy();
  });

  it('renders the Sign out button', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  it('calls signOut when Sign out is pressed', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Sign out'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
