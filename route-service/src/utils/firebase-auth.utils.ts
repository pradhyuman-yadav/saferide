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
 * Generates a Firebase password-reset / account-setup link and dispatches it
 * via the configured email provider.
 *
 * Deployment note — two options for email delivery:
 *
 * Option A (recommended for most deployments): configure Firebase Auth email
 * templates in Firebase Console → Authentication → Templates → Password reset.
 * Firebase sends the email automatically when the client SDK calls
 * `sendPasswordResetEmail()`. No backend email code is needed.
 *
 * Option B (server-triggered, e.g. admin creates a driver account): call
 * `generatePasswordResetLink()` here and pass the link to a transactional
 * email provider (SendGrid, Postmark, AWS SES). Replace the logger call below
 * with: `await emailService.send({ to: email, template: 'account-setup', link })`
 * The link is valid for 1 hour.
 *
 * The send is non-fatal — a failure is logged and the user can request a
 * password reset via the app later.
 */
export async function sendSetupEmail(email: string): Promise<void> {
  try {
    const auth = getAdminAuth();
    const link = await auth.generatePasswordResetLink(email);
    // Replace this log line with your email provider call (see Option B above)
    logger.info({ email, link }, 'Account setup link generated');
  } catch (err) {
    // Non-fatal — driver/parent can request a reset via the app later
    logger.warn({ email, err }, 'Could not generate setup link; user can reset via the app');
  }
}
