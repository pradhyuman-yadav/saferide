import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '@app/(auth)/login';
import * as firebaseAuth from '@/firebase/auth';

describe('LoginScreen', () => {
  it('renders the SafeRide brand name in the hero', () => {
    render(<LoginScreen />);
    expect(screen.getByText('SafeRide')).toBeTruthy();
  });

  it('renders email and password inputs', () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('renders Continue button', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('renders toggle to switch between sign-in and create account', () => {
    render(<LoginScreen />);
    expect(screen.getByText("New here? Create an account")).toBeTruthy();
  });

  it('toggles to "Create account" mode', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText("New here? Create an account"));
    expect(screen.getAllByText('Create account').length).toBeGreaterThan(0);
    expect(screen.getByText('Already have an account? Sign in')).toBeTruthy();
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

  it('calls createAccount in create-account mode', async () => {
    (firebaseAuth.createAccount as jest.Mock).mockResolvedValueOnce({});
    render(<LoginScreen />);

    // Switch to create mode
    fireEvent.press(screen.getByText("New here? Create an account"));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'new@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'newpass123');
    // Press the button (last "Create account" element is the button)
    const createBtns = screen.getAllByText('Create account');
    fireEvent.press(createBtns[createBtns.length - 1]);

    await waitFor(() => {
      expect(firebaseAuth.createAccount).toHaveBeenCalledWith('new@example.com', 'newpass123');
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
});
