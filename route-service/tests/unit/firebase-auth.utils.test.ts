import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------

const {
  mockGetUserByEmail,
  mockCreateUser,
  mockGeneratePasswordResetLink,
  mockAdminAuth,
} = vi.hoisted(() => {
  const mockGetUserByEmail           = vi.fn();
  const mockCreateUser               = vi.fn();
  const mockGeneratePasswordResetLink = vi.fn();
  const mockAdminAuth = {
    getUserByEmail:           mockGetUserByEmail,
    createUser:               mockCreateUser,
    generatePasswordResetLink: mockGeneratePasswordResetLink,
  };
  return { mockGetUserByEmail, mockCreateUser, mockGeneratePasswordResetLink, mockAdminAuth };
});

vi.mock('@saferide/firebase-admin', () => ({
  getAdminAuth: vi.fn(() => mockAdminAuth),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  auditLog: vi.fn(),
}));

import { findOrCreateFirebaseUser, sendSetupEmail } from '../../src/utils/firebase-auth.utils';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('findOrCreateFirebaseUser()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the uid of an existing Firebase Auth user', async () => {
    mockGetUserByEmail.mockResolvedValue({ uid: 'existing-uid' });

    const uid = await findOrCreateFirebaseUser('driver@school.edu', 'Raju Driver');

    expect(mockGetUserByEmail).toHaveBeenCalledWith('driver@school.edu');
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(uid).toBe('existing-uid');
  });

  it('creates a new passwordless user when the email is not registered', async () => {
    mockGetUserByEmail.mockRejectedValue(new Error('auth/user-not-found'));
    mockCreateUser.mockResolvedValue({ uid: 'new-uid' });

    const uid = await findOrCreateFirebaseUser('newdriver@school.edu', 'New Driver');

    expect(mockCreateUser).toHaveBeenCalledWith({
      email:       'newdriver@school.edu',
      displayName: 'New Driver',
    });
    expect(uid).toBe('new-uid');
  });
});

describe('sendSetupEmail()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a password reset link and logs it', async () => {
    const { logger } = await import('@saferide/logger');
    mockGeneratePasswordResetLink.mockResolvedValue('https://reset.link/xyz');

    await sendSetupEmail('driver@school.edu');

    expect(mockGeneratePasswordResetLink).toHaveBeenCalledWith('driver@school.edu');
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'driver@school.edu', link: 'https://reset.link/xyz' }),
      expect.any(String),
    );
  });

  it('logs a warning and does not throw when link generation fails', async () => {
    const { logger } = await import('@saferide/logger');
    mockGeneratePasswordResetLink.mockRejectedValue(new Error('Firebase error'));

    await expect(sendSetupEmail('driver@school.edu')).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'driver@school.edu' }),
      expect.any(String),
    );
  });
});
