import type { Request } from 'express';
import jwt from 'jsonwebtoken';

const SENSITIVE_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const SENSITIVE_TOKEN_SECRET = process.env.SENSITIVE_TOKEN_SECRET ?? 'dev-secret-change-in-prod';

export function issueSensitiveToken(params: {
  userId: string;
  method: 'password' | 'otp';
  purpose: 'catalog_disclaimer' | 'consent_signing';
  req: Pick<Request, 'ip'>;
}): { verificationToken: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + SENSITIVE_TOKEN_EXPIRY_MS);
  const payload = {
    sub: params.userId,
    purpose: params.purpose,
    method: params.method,
    exp: Math.floor(expiresAt.getTime() / 1000),
    ip: params.req.ip ?? 'unknown',
  };
  const token = jwt.sign(payload, SENSITIVE_TOKEN_SECRET);
  return { verificationToken: token, expiresAt };
}

export function verifySensitiveToken(
  token: string,
  expectedPurpose: string,
  expectedUserId: string,
): void {
  try {
    const payload = jwt.verify(token, SENSITIVE_TOKEN_SECRET) as {
      sub: string;
      purpose: string;
      exp: number;
    };

    if (payload.purpose !== expectedPurpose) {
      throw new Error('TOKEN_PURPOSE_MISMATCH');
    }
    if (payload.sub !== expectedUserId) {
      throw new Error('TOKEN_USER_MISMATCH');
    }
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      throw new Error('INVALID_SENSITIVE_TOKEN');
    }
    throw err;
  }
}
