import { Router, type Request, type Response } from 'express';
import { registerRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { RegistrationError, registerUser } from '../../services/registration-service';

/**
 * Kept as a non-mounted compatibility export for the archived transition
 * tests. Public account-existence checks are intentionally disabled because
 * they enable user enumeration and depend on the removed legacy profile
 * tables.
 */
export function createAvailabilityHandler(_db: SupabaseLike) {
  return async (_req: Request, res: Response) => res.status(410).json({
    error: 'REGISTRATION_AVAILABILITY_DISABLED',
  });
}

export function createRegisterRouter(db: SupabaseLike): Router {
  const router = Router();
  router.post('/register', createRegisterHandler(db));
  return router;
}

export function createRegisterHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const parsed = registerRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });

    try {
      const result = await registerUser(db, parsed.data, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof RegistrationError) {
        return res.status(error.details.status).json({ error: error.details.code });
      }
      return res.status(500).json({ error: 'REGISTRATION_FAILED' });
    }
  };
}
