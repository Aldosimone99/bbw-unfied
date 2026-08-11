import { Router, type Request, type Response } from 'express';
import { consentOtpPayloadSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { resolveUser } from '../../middleware/resolve-user-middleware';
import { issueOtp, validateOtp, AuthError } from '../../services/otp-service';
import { issueSensitiveToken } from '../../services/sensitive-token-service';
import { rateLimit, RateLimitError } from '../../services/rate-limit-service';

export function createTokenRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/verify', resolveUser(db), createVerifyHandler());
  router.post('/consent-otp/request', resolveUser(db), createConsentOtpRequestHandler(db));
  router.post('/consent-otp/verify', resolveUser(db), createConsentOtpVerifyHandler(db));

  return router;
}

function createVerifyHandler() {
  return (req: Request, res: Response) => {
    res.json({ success: true, user: req.user });
  };
}

function createConsentOtpRequestHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = consentOtpPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    }

    try {
      await rateLimit({ key: `consent-otp:${parsed.data.email}`, limit: 5, window: 10 * 60 * 1000 });
      await rateLimit({ key: `consent-otp-ip:${req.ip ?? 'unknown'}`, limit: 20, window: 10 * 60 * 1000 });

      const result = await issueOtp({
        email: parsed.data.email,
        purpose: 'consent',
        userId: req.user!.id,
      }, db);

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}

function createConsentOtpVerifyHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = consentOtpPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    }

    try {
      await rateLimit({ key: `consent-otp-verify:${parsed.data.email}`, limit: 8, window: 10 * 60 * 1000 });
      await rateLimit({ key: `consent-otp-verify-ip:${req.ip ?? 'unknown'}`, limit: 30, window: 10 * 60 * 1000 });

      const otpPayload = { ...parsed.data, code: req.body.code };
      await validateOtp(otpPayload, db);

      const token = await issueSensitiveToken({
        userId: req.user!.id,
        method: 'otp',
        purpose: 'consent_signing',
        req,
      });

      return res.status(200).json({ success: true, ...token });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      }
      if (error instanceof AuthError) {
        return res.status(401).json({ error: error.message });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
