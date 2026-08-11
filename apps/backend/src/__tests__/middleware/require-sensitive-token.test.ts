import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireSensitiveToken } from '../../middleware/require-sensitive-token';
import jwt from 'jsonwebtoken';

const SENSITIVE_TOKEN_SECRET = process.env.SENSITIVE_TOKEN_SECRET ?? 'dev-secret-change-in-prod';

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, SENSITIVE_TOKEN_SECRET, { expiresIn: '10m' });
}

function makeReq(overrides: Record<string, unknown> = {}): Request {
  return {
    headers: {},
    user: { id: 'user-1', email: 'test@example.com', tipo_utente: 'cliente' },
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('require-sensitive-token', () => {
  it('returns 403 when x-verification-token header is absent', () => {
    const middleware = requireSensitiveToken('catalog_disclaimer');
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'SENSITIVE_TOKEN_REQUIRED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token purpose does not match route purpose', () => {
    const token = makeToken({ sub: 'user-1', purpose: 'consent_signing' });
    const middleware = requireSensitiveToken('catalog_disclaimer');
    const req = makeReq({ headers: { 'x-verification-token': token } });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_PURPOSE_MISMATCH' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token sub does not match req.user.id', () => {
    const token = makeToken({ sub: 'user-2', purpose: 'catalog_disclaimer' });
    const middleware = requireSensitiveToken('catalog_disclaimer');
    const req = makeReq({ headers: { 'x-verification-token': token } });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_USER_MISMATCH' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for expired token', () => {
    vi.useFakeTimers();
    const token = makeToken({ sub: 'user-1', purpose: 'catalog_disclaimer' });
    vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes

    const middleware = requireSensitiveToken('catalog_disclaimer');
    const req = makeReq({ headers: { 'x-verification-token': token } });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'INVALID_SENSITIVE_TOKEN' });
    expect(next).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('returns 403 for malformed token', () => {
    const middleware = requireSensitiveToken('catalog_disclaimer');
    const req = makeReq({ headers: { 'x-verification-token': 'not-a-valid-token' } });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'INVALID_SENSITIVE_TOKEN' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when req.user is undefined', () => {
    const token = makeToken({ sub: 'user-1', purpose: 'catalog_disclaimer' });
    const middleware = requireSensitiveToken('catalog_disclaimer');
    const req = makeReq({ headers: { 'x-verification-token': token }, user: undefined });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_USER_MISMATCH' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when all checks pass', () => {
    const token = makeToken({ sub: 'user-1', purpose: 'catalog_disclaimer' });
    const middleware = requireSensitiveToken('catalog_disclaimer');
    const req = makeReq({ headers: { 'x-verification-token': token } });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
