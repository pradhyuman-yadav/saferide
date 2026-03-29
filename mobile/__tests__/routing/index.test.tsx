import React from 'react';
import { render } from '@testing-library/react-native';
import IndexScreen from '@app/index';
import { useAuthStore } from '@/store/auth.store';
import type { UserProfile } from '@/types/user';

// `mockReplace` starts with 'mock' so babel-plugin-jest-hoist hoists it above imports.
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter:   () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  usePathname: jest.fn(() => '/'),
  useSegments: jest.fn(() => []),
  Redirect:    ({ href }: { href: string }) => null,
  Stack:       ({ children }: { children: React.ReactNode }) => children,
  Tabs:        ({ children }: { children: React.ReactNode }) => children,
  Link:        ({ children }: { children: React.ReactNode }) => children,
}));

const PROFILE_BASE: UserProfile = {
  uid: 'u1', name: 'Test', tenantId: 'school_1',
  createdAt: Date.now(), updatedAt: Date.now(), role: 'parent',
};

beforeEach(() => {
  mockReplace.mockClear();
  useAuthStore.setState({ user: null, profile: null, role: null, isLoading: false });
});

describe('Index routing', () => {
  it('redirects to login when not authenticated', () => {
    render(<IndexScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('redirects to onboarding when authenticated but no role', () => {
    useAuthStore.setState({ user: { uid: 'u1' } as any, profile: null, role: null, isLoading: false });
    render(<IndexScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
  });

  it('redirects to (parent) for parent role', () => {
    useAuthStore.setState({ user: { uid: 'u1' } as any, profile: { ...PROFILE_BASE, role: 'parent' }, role: 'parent', isLoading: false });
    render(<IndexScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(parent)/');
  });

  it('redirects to (driver) for driver role', () => {
    useAuthStore.setState({ user: { uid: 'u1' } as any, profile: { ...PROFILE_BASE, role: 'driver' }, role: 'driver', isLoading: false });
    render(<IndexScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(driver)/');
  });

  it('redirects to (manager) for manager role', () => {
    useAuthStore.setState({ user: { uid: 'u1' } as any, profile: { ...PROFILE_BASE, role: 'manager' }, role: 'manager', isLoading: false });
    render(<IndexScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(manager)/');
  });

  it('redirects to (admin) for school_admin role', () => {
    useAuthStore.setState({ user: { uid: 'u1' } as any, profile: { ...PROFILE_BASE, role: 'school_admin' }, role: 'school_admin', isLoading: false });
    render(<IndexScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(admin)/');
  });

  it('shows loading spinner without redirecting when isLoading is true', () => {
    useAuthStore.setState({ user: null, profile: null, role: null, isLoading: true });
    render(<IndexScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
