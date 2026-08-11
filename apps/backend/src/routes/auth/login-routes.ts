import { Router, type Request, type Response } from 'express';
import { loginPayloadSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { login, RateLimitError } from '../../services/login-service';

export function createLoginRouter(db: SupabaseLike): Router {
  const router = Router();
  router.post('/login', createLoginHandler(db));
  return router;
}

export function createLoginHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = loginPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    }

    try {
      const result = await login(db, parsed.data, req);

      if (!result.success) {
        return res.status(result.status).json({ error: result.code });
      }

      return res.status(200).json({
        success: true,
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
