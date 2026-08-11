import { Router, type Request, type Response } from 'express';
import { sendOtpPayloadSchema, verifyOtpPayloadSchema, resendOtpPayloadSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { issueOtp, validateOtp, resendOtp, AuthError } from '../../services/otp-service';
import { rateLimit, RateLimitError } from '../../services/rate-limit-service';

export function createOtpRouter(db: SupabaseLike): Router {
  const router = Router();

  router.post('/otp/send', createSendOtpHandler(db));
  router.post('/otp/resend', createResendOtpHandler(db));
  router.post('/otp/verify', createVerifyOtpHandler(db));

  return router;
}

function createSendOtpHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = sendOtpPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    }

    try {
      await rateLimit({ key: `otp-send:${parsed.data.email}`, limit: 5, window: 10 * 60 * 1000 });
      await rateLimit({ key: `otp-send-ip:${req.ip ?? 'unknown'}`, limit: 20, window: 10 * 60 * 1000 });

      const result = await issueOtp({ email: parsed.data.email, purpose: parsed.data.purpose }, db);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}

function createResendOtpHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = resendOtpPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    }

    try {
      const result = await resendOtp(parsed.data.email, parsed.data.purpose, db);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}

function createVerifyOtpHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = verifyOtpPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    }

    try {
      await validateOtp(parsed.data, db);
      return res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(401).json({ error: error.message });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
