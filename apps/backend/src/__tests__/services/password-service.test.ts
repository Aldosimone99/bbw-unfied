import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../services/rate-limit-service', () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {
    constructor(message: string) { super(message); this.name = 'RateLimitError'; }
  },
}));

vi.mock('../../services/sensitive-token-service', () => ({
  issueSensitiveToken: vi.fn().mockReturnValue({
    verificationToken: 'mock-sensitive-token',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }),
}));

import {
  forgotPassword,
  resetPassword,
  verifyPassword,
  assertPasswordStrength,
  ValidationError,
  AuthError,
  RateLimitError,
} from '../../services/password-service';
import { issueSensitiveToken } from '../../services/sensitive-token-service';
import { rateLimit } from '../../services/rate-limit-service';

const mockRateLimit = vi.mocked(rateLimit);
const mockIssueSensitiveToken = vi.mocked(issueSensitiveToken);
const mockReq = { ip: '127.0.0.1' };

function makeDb(overrides: Record<string, unknown> = {}) {
  const mockSignIn = vi.fn().mockResolvedValue(
    overrides.authError
      ? { data: null, error: overrides.authError }
      : { data: { session: { access_token: 'token' } }, error: null },
  );

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue(
            overrides.userNotFound
              ? { data: null, error: null }
              : { data: { email: 'mario@example.com' }, error: null },
          ),
        })),
      })),
    })),
    auth: {
      signInWithPassword: mockSignIn,
      admin: {
        generateLink: vi.fn().mockResolvedValue(
          overrides.generateLinkError
            ? { data: null, error: overrides.generateLinkError }
            : { data: { properties: {} }, error: null },
        ),
        updateUserById: vi.fn().mockResolvedValue(
          overrides.updateError
            ? { data: null, error: overrides.updateError }
            : { data: { user: {} }, error: null },
        ),
      },
      verifyOtp: vi.fn().mockResolvedValue(
        overrides.verifyOtpError
          ? { data: null, error: overrides.verifyOtpError }
          : { data: { user: { id: 'user-1' } }, error: null },
      ),
    },
  };
}

describe('assertPasswordStrength', () => {
  it('passes for strong passwords (12+ chars, uppercase, lowercase, digit, symbol)', () => {
    expect(() => assertPasswordStrength('StrongPass123!')).not.toThrow();
  });

  it('throws PASSWORD_TOO_SHORT for passwords under 12 chars', () => {
    expect(() => assertPasswordStrength('Short1!')).toThrow('PASSWORD_TOO_SHORT');
  });

  it('throws PASSWORD_MISSING_UPPERCASE when no uppercase', () => {
    expect(() => assertPasswordStrength('weakpassword1!')).toThrow('PASSWORD_MISSING_UPPERCASE');
  });

  it('throws PASSWORD_MISSING_LOWERCASE when no lowercase', () => {
    expect(() => assertPasswordStrength('WEAKPASSWORD1!')).toThrow('PASSWORD_MISSING_LOWERCASE');
  });

  it('throws PASSWORD_MISSING_DIGIT when no digit', () => {
    expect(() => assertPasswordStrength('WeakPassword!')).toThrow('PASSWORD_MISSING_DIGIT');
  });

  it('throws PASSWORD_MISSING_SYMBOL when no symbol', () => {
    expect(() => assertPasswordStrength('WeakPassword1')).toThrow('PASSWORD_MISSING_SYMBOL');
  });
});

describe('forgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
  });

  it('returns success:true even for non-existent email (anti-enumeration)', async () => {
    const db = makeDb({ userNotFound: true });
    const result = await forgotPassword(db, { email: 'nobody@example.com' }, mockReq);
    expect(result).toEqual({ success: true });
  });

  it('returns success:true for valid email', async () => {
    const db = makeDb();
    const result = await forgotPassword(db, { email: 'mario@example.com' }, mockReq);
    expect(result).toEqual({ success: true });
  });

  it('calls generateLink for non-suppressed email', async () => {
    const db = makeDb();
    await forgotPassword(db, { email: 'mario@example.com' }, mockReq);
    expect(db.auth.admin.generateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'mario@example.com',
    });
  });

  it('applies rate limits: 5 per email, 20 per IP in 10 min', async () => {
    const db = makeDb();
    await forgotPassword(db, { email: 'mario@example.com' }, mockReq);
    expect(mockRateLimit).toHaveBeenCalledTimes(2);
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'forgot-email:mario@example.com', limit: 5 }),
    );
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'forgot-ip:127.0.0.1', limit: 20 }),
    );
  });

  it('throws RateLimitError when rate limit exceeded', async () => {
    mockRateLimit.mockRejectedValueOnce(new RateLimitError('RATE_LIMIT_EXCEEDED'));
    const db = makeDb();
    await expect(forgotPassword(db, { email: 'mario@example.com' }, mockReq))
      .rejects.toThrow('RATE_LIMIT_EXCEEDED');
  });
});

describe('resetPassword', () => {
  it('rejects weak passwords with ValidationError', async () => {
    await expect(resetPassword({} as never, { newPassword: 'short' }, 'user-1'))
      .rejects.toThrow(ValidationError);
  });

  it('rejects weak passwords with specific error code', async () => {
    await expect(resetPassword({} as never, { newPassword: 'short' }, 'user-1'))
      .rejects.toThrow('PASSWORD_TOO_SHORT');
  });

  it('accepts strong passwords and calls updateUserById', async () => {
    const db = makeDb();
    await resetPassword(db, { newPassword: 'StrongPass123!' }, 'user-1');
    expect(db.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', {
      password: 'StrongPass123!',
    });
  });

  it('throws AuthError when updateUserById fails', async () => {
    const db = makeDb({ updateError: new Error('DB error') });
    await expect(resetPassword(db, { newPassword: 'StrongPass123!' }, 'user-1'))
      .rejects.toThrow(AuthError);
  });

  it('returns success:true on successful reset', async () => {
    const db = makeDb();
    const result = await resetPassword(db, { newPassword: 'StrongPass123!' }, 'user-1');
    expect(result).toEqual({ success: true });
  });

  it('does not touch users table (only calls Supabase Auth admin)', async () => {
    const db = makeDb();
    await resetPassword(db, { newPassword: 'StrongPass123!' }, 'user-1');
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe('verifyPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues sensitive token on valid password', async () => {
    const db = makeDb();
    const result = await verifyPassword(db, { password: 'Pass123!' }, 'user-1', mockReq);
    expect(mockIssueSensitiveToken).toHaveBeenCalledWith({
      userId: 'user-1',
      method: 'password',
      purpose: 'consent_signing',
      req: mockReq,
    });
    expect(result.verificationToken).toBe('mock-sensitive-token');
  });

  it('throws AuthError when password is invalid', async () => {
    const db = makeDb({ authError: new Error('Invalid login credentials') });
    await expect(verifyPassword(db, { password: 'WrongPass!' }, 'user-1', mockReq))
      .rejects.toThrow(AuthError);
  });

  it('throws AuthError when user is not found in users table', async () => {
    const db = makeDb({ userNotFound: true });
    await expect(verifyPassword(db, { password: 'Pass123!' }, 'non-existent-user', mockReq))
      .rejects.toThrow('USER_NOT_FOUND');
  });
});
