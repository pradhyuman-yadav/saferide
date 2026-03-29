import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '@app/(auth)/onboarding';
import { useAuthStore } from '@/store/auth.store';
import * as firestore from '@/firebase/firestore';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  Redirect: () => null,
  Stack: () => null,
  Link: () => null,
}));

const MOCK_PROFILE = {
  uid: 'user_123', email: 'priya@example.com', name: 'Priya',
  role: 'parent' as const, tenantId: 'school_1',
  createdAt: Date.now(), updatedAt: Date.now(),
};

beforeEach(() => {
  useAuthStore.setState({
    user:      { uid: 'user_123', email: 'priya@example.com', displayName: 'Priya' } as any,
    profile:   null,
    role:      null,
    isLoading: false,
  });
  mockReplace.mockClear();
});

describe('OnboardingScreen', () => {
  it('renders invite code heading', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText('Enter your invite code')).toBeTruthy();
  });

  it('renders invite code input', () => {
    render(<OnboardingScreen />);
    expect(screen.getByPlaceholderText('e.g. SR-XYZABC')).toBeTruthy();
  });

  it('shows contact-admin hint', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText(/contact your school/i)).toBeTruthy();
  });

  it('does not call redeemInviteCode when code is empty', async () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Redeem code'));
    await waitFor(() => {
      expect(firestore.redeemInviteCode).not.toHaveBeenCalled();
    });
  });

  it('calls redeemInviteCode with trimmed uppercased code on submit', async () => {
    (firestore.redeemInviteCode as jest.Mock).mockResolvedValueOnce(MOCK_PROFILE);
    render(<OnboardingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('e.g. SR-XYZABC'), 'sr-abc123');
    fireEvent.press(screen.getByText('Redeem code'));
    await waitFor(() => {
      expect(firestore.redeemInviteCode).toHaveBeenCalledWith(
        'user_123',
        'priya@example.com',
        'Priya',
        'sr-abc123',
      );
    });
  });

  it('navigates to root after successful code redemption', async () => {
    (firestore.redeemInviteCode as jest.Mock).mockResolvedValueOnce(MOCK_PROFILE);
    render(<OnboardingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('e.g. SR-XYZABC'), 'SR-VALID1');
    fireEvent.press(screen.getByText('Redeem code'));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('updates store profile after redemption', async () => {
    (firestore.redeemInviteCode as jest.Mock).mockResolvedValueOnce(MOCK_PROFILE);
    render(<OnboardingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('e.g. SR-XYZABC'), 'SR-VALID1');
    fireEvent.press(screen.getByText('Redeem code'));
    await waitFor(() => {
      expect(useAuthStore.getState().role).toBe('parent');
    });
  });
});
