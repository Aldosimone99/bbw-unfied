import type { Request } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { rateLimit, RateLimitError } from './rate-limit-service';
import { AuthError } from './otp-service';
import { issueSensitiveToken } from './sensitive-token-service';

export { RateLimitError, AuthError };

const FORGOT_LIMITS = {
  perEmail: { key: 'forgot-email', limit: 5, window: 10 * 60 * 1000 },
  perIp: { key: 'forgot-ip', limit: 20, window: 10 * 60 * 1000 },
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function assertPasswordStrength(password: string): void {
  if (password.length < 12) throw new ValidationError('PASSWORD_TOO_SHORT');
  if (!/[A-Z]/.test(password)) throw new ValidationError('PASSWORD_MISSING_UPPERCASE');
  if (!/[a-z]/.test(password)) throw new ValidationError('PASSWORD_MISSING_LOWERCASE');
  if (!/[0-9]/.test(password)) throw new ValidationError('PASSWORD_MISSING_DIGIT');
  if (!/[^A-Za-z0-9]/.test(password)) throw new ValidationError('PASSWORD_MISSING_SYMBOL');
}

/** Stub: always returns false. Replace with real suppression check when available. */
export async function isEmailSuppressedForPassword(_email: string): Promise<boolean> {
  return false;
}

export async function forgotPassword(
  db: SupabaseLike,
  payload: { email: string },
  req: Pick<Request, 'ip'>,
): Promise<{ success: true }> {
  await rateLimit({ ...FORGOT_LIMITS.perEmail, key: `${FORGOT_LIMITS.perEmail.key}:${payload.email}` });
  await rateLimit({ ...FORGOT_LIMITS.perIp, key: `${FORGOT_LIMITS.perIp.key}:${req.ip ?? 'unknown'}` });

  const suppressed = await isEmailSuppressedForPassword(payload.email);
  if (!suppressed) {
    const { error } = await db.auth.admin.generateLink({
      type: 'recovery',
      email: payload.email,
    });
    if (error) {
      // Log but still return 200 — no enumeration
      console.warn(`forgotPassword: generateLink failed for ${payload.email}:`, error.message);
    }
  }

  return { success: true };
}

export async function resetPassword(
  db: SupabaseLike,
  payload: { newPassword: string; tokenHash?: string },
  userId?: string,
): Promise<{ success: true }> {
  assertPasswordStrength(payload.newPassword);

  if (payload.tokenHash) {
    const { data: otpData, error: otpError } = await db.auth.verifyOtp({
      type: 'recovery',
      token_hash: payload.tokenHash,
    });
    if (otpError) throw new AuthError(`RESET_TOKEN_INVALID: ${otpError.message}`);
    userId = otpData?.user?.id;
  }

  if (!userId) throw new AuthError('RESET_USER_REQUIRED');

  const { error } = await db.auth.admin.updateUserById(userId, {
    password: payload.newPassword,
  });
  if (error) throw new AuthError(`PASSWORD_UPDATE_FAILED: ${error.message}`);

  return { success: true };
}

export async function verifyPassword(
  db: SupabaseLike,
  payload: { password: string },
  userId: string,
  req: Pick<Request, 'ip'>,
): Promise<{ verificationToken: string; expiresAt: Date }> {
  const { data: userData, error: userError } = await db
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !userData) {
    throw new AuthError('USER_NOT_FOUND');
  }

  const { data, error } = await db.auth.signInWithPassword({
    email: userData.email,
    password: payload.password,
  });

  if (error || !data?.session) {
    throw new AuthError('INVALID_PASSWORD');
  }

  const token = await issueSensitiveToken({
    userId,
    method: 'password',
    purpose: 'consent_signing',
    req,
  });

  return token;
}
