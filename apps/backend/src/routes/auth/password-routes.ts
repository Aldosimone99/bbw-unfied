import { Router, type Request, type Response } from 'express';
import {
  forgotPasswordPayloadSchema,
  resetPasswordPayloadSchema,
  verifyPasswordPayloadSchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import {
  forgotPassword,
  resetPassword,
  verifyPassword,
  RateLimitError,
  AuthError,
  ValidationError,
} from '../../services/password-service';
import { resolveUser } from '../../middleware/resolve-user-middleware';

export function createPasswordRouter(db: SupabaseLike): Router {
  const router = Router();

  router.post('/forgot-password', createForgotPasswordHandler(db));
  router.post('/reset-password', createResetPasswordHandler(db));
  router.post('/verify-password', resolveUser(db), createVerifyPasswordHandler(db));

  return router;
}

function createForgotPasswordHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = forgotPasswordPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    }

    try {
      await forgotPassword(db, parsed.data, req);
      return res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}

function createResetPasswordHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = resetPasswordPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: 'VALIDATION_FAILED',
        issues: parsed.error.issues.map((i) => i.message),
      });
    }

    try {
      const userId = req.user?.id;
      await resetPassword(db, parsed.data, userId);
      return res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(422).json({ error: error.message });
      }
      if (error instanceof AuthError) {
        return res.status(401).json({ error: error.message });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}

function createVerifyPasswordHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = verifyPasswordPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    }

    try {
      const result = await verifyPassword(db, parsed.data, req.user!.id, req);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(401).json({ error: error.message });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
