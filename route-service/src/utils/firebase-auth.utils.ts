import { getAdminAuth } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';

/**
 * Returns the Firebase UID for the given email.
 * If no Firebase Auth account exists yet, creates one (no password — the user
 * will set their password via the setup link sent by sendSetupEmail).
 */
export async function findOrCreateFirebaseUser(
  email: string,
  displayName: string,
): Promise<string> {
  const auth = getAdminAuth();
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch {
    // User not found — create a passwordless account
    const created = await auth.createUser({ email, displayName });
    return created.uid;
  }
}

/**
 * Generates a Firebase password-reset link for the given email and logs it.
 *
 * In production, wire this to a transactional email service (SendGrid, etc.)
 * or configure Firebase Auth email templates in the Firebase Console →
 * Authentication → Templates → Password reset. The link is valid for 1 hour.
 *
 * Firebase Console email templates require no code changes — Firebase sends
 * the email automatically when you call the Identity Platform REST API
 * (POST /accounts:sendOobCode), which is what the Firebase client SDK
 * `sendPasswordResetEmail()` calls under the hood. For server-triggered flows
 * (school admin creating a driver/parent), we use generatePasswordResetLink()
 * to get the link and hand it off to the email delivery layer.
 */
export async function sendSetupEmail(email: string): Promise<void> {
  try {
    const auth = getAdminAuth();
    const link = await auth.generatePasswordResetLink(email);
    // TODO (production): send `link` via your email provider
    // Example: await emailService.send({ to: email, template: 'account-setup', link })
    logger.info({ email, link }, 'Account setup link generated (wire to email provider for production)');
  } catch (err) {
    // Non-fatal — driver/parent can request a reset via the app later
    logger.warn({ email, err }, 'Could not generate setup link; user can reset via the app');
  }
}
