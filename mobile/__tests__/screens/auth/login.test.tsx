import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '@app/(auth)/login';
import * as firebaseAuth from '@/firebase/auth';

// Ensure resetPassword is available on the mock
jest.mock('@/firebase/auth', () => ({
  subscribeToAuthState: jest.fn((cb: (u: null) => void) => { cb(null); return jest.fn(); }),
  signInWithEmail:      jest.fn(),
  createAccount:        jest.fn(),
  signOut:              jest.fn(),
  resetPassword:        jest.fn().mockResolvedValue(undefined),
}));

describe('LoginScreen', () => {
  it('renders email and password inputs', () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('renders Continue button', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('renders Forgot password button', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });

  it('renders the tagline in the hero', () => {
    render(<LoginScreen />);
    expect(screen.getByText('School bus safety platform')).toBeTruthy();
  });

  it('accepts email input', () => {
    render(<LoginScreen />);
    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.changeText(emailInput, 'priya@example.com');
    expect(emailInput.props.value).toBe('priya@example.com');
  });

  it('accepts password input', () => {
    render(<LoginScreen />);
    const pwInput = screen.getByPlaceholderText('••••••••');
    fireEvent.changeText(pwInput, 'secret123');
    expect(pwInput.props.value).toBe('secret123');
  });

  it('calls signInWithEmail with correct args on submit', async () => {
    (firebaseAuth.signInWithEmail as jest.Mock).mockResolvedValueOnce({});
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'priya@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'secret123');
    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => {
      expect(firebaseAuth.signInWithEmail).toHaveBeenCalledWith('priya@example.com', 'secret123');
    });
  });

  it('does not call signIn when fields are empty', async () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => {
      expect(firebaseAuth.signInWithEmail).not.toHaveBeenCalled();
    });
  });

  it('password field is secure text entry', () => {
    render(<LoginScreen />);
    const pwInput = screen.getByPlaceholderText('••••••••');
    expect(pwInput.props.secureTextEntry).toBe(true);
  });

  it('email field has email keyboard type', () => {
    render(<LoginScreen />);
    const emailInput = screen.getByPlaceholderText('you@example.com');
    expect(emailInput.props.keyboardType).toBe('email-address');
  });

  it('email field auto-capitalizes none', () => {
    render(<LoginScreen />);
    const emailInput = screen.getByPlaceholderText('you@example.com');
    expect(emailInput.props.autoCapitalize).toBe('none');
  });

  it('shows error alert when signInWithEmail throws', async () => {
    (firebaseAuth.signInWithEmail as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'bad@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Invalid credentials'),
      );
    });
  });

  it('shows enter-email alert when Forgot password pressed with empty email', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Forgot password?'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  it('calls resetPassword and shows success alert when email is present', async () => {
    (firebaseAuth.resetPassword as jest.Mock).mockResolvedValueOnce(undefined);
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'priya@example.com');
    fireEvent.press(screen.getByText('Forgot password?'));

    await waitFor(() => {
      expect(firebaseAuth.resetPassword).toHaveBeenCalledWith('priya@example.com');
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  it('shows error alert when resetPassword throws', async () => {
    (firebaseAuth.resetPassword as jest.Mock).mockRejectedValueOnce(new Error('Not found'));
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'priya@example.com');
    fireEvent.press(screen.getByText('Forgot password?'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Not found'),
      );
    });
  });
});
