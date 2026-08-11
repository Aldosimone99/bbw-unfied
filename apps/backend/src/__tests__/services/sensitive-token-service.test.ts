import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { issueSensitiveToken, verifySensitiveToken } from '../../services/sensitive-token-service';

const mockReq = { ip: '192.168.1.1' };

describe('issueSensitiveToken', () => {
  it('returns a verificationToken and expiresAt', () => {
    const result = issueSensitiveToken({
      userId: 'user-1',
      method: 'password',
      purpose: 'consent_signing',
      req: mockReq,
    });

    expect(result.verificationToken).toBeDefined();
    expect(typeof result.verificationToken).toBe('string');
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('token expires in approximately 10 minutes', () => {
    const before = Date.now();
    const result = issueSensitiveToken({
      userId: 'user-1',
      method: 'password',
      purpose: 'consent_signing',
      req: mockReq,
    });
    const after = Date.now();

    const expiresMs = result.expiresAt.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 10 * 60 * 1000);
  });

  it('token contains sub, purpose, method, exp, ip in payload', () => {
    const result = issueSensitiveToken({
      userId: 'user-1',
      method: 'password',
      purpose: 'catalog_disclaimer',
      req: { ip: '10.0.0.1' },
    });

    const decoded = jwt.decode(result.verificationToken) as Record<string, unknown>;
    expect(decoded.sub).toBe('user-1');
    expect(decoded.purpose).toBe('catalog_disclaimer');
    expect(decoded.method).toBe('password');
    expect(decoded.ip).toBe('10.0.0.1');
    expect(decoded.exp).toBeDefined();
    expect(typeof decoded.exp).toBe('number');
  });
});

describe('verifySensitiveToken', () => {
  it('passes when token is valid and matches purpose and user', () => {
    const { verificationToken } = issueSensitiveToken({
      userId: 'user-1',
      method: 'password',
      purpose: 'consent_signing',
      req: mockReq,
    });

    expect(() => verifySensitiveToken(verificationToken, 'consent_signing', 'user-1')).not.toThrow();
  });

  it('throws TOKEN_PURPOSE_MISMATCH when purpose does not match', () => {
    const { verificationToken } = issueSensitiveToken({
      userId: 'user-1',
      method: 'password',
      purpose: 'consent_signing',
      req: mockReq,
    });

    expect(() => verifySensitiveToken(verificationToken, 'catalog_disclaimer', 'user-1')).toThrow('TOKEN_PURPOSE_MISMATCH');
  });

  it('throws TOKEN_USER_MISMATCH when sub does not match expected userId', () => {
    const { verificationToken } = issueSensitiveToken({
      userId: 'user-1',
      method: 'password',
      purpose: 'consent_signing',
      req: mockReq,
    });

    expect(() => verifySensitiveToken(verificationToken, 'consent_signing', 'user-2')).toThrow('TOKEN_USER_MISMATCH');
  });

  it('throws INVALID_SENSITIVE_TOKEN for expired token', () => {
    vi.useFakeTimers();
    const { verificationToken } = issueSensitiveToken({
      userId: 'user-1',
      method: 'password',
      purpose: 'consent_signing',
      req: mockReq,
    });

    vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes

    expect(() => verifySensitiveToken(verificationToken, 'consent_signing', 'user-1')).toThrow('INVALID_SENSITIVE_TOKEN');
    vi.useRealTimers();
  });

  it('throws INVALID_SENSITIVE_TOKEN for malformed token', () => {
    expect(() => verifySensitiveToken('not-a-valid-token', 'consent_signing', 'user-1')).toThrow('INVALID_SENSITIVE_TOKEN');
  });
});
