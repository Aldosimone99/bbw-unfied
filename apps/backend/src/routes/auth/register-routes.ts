import { Router, type Request, type Response } from 'express';
import { registerRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { RegistrationError, registerUser } from '../../services/registration-service';

const availabilityMap = {
  email: ['users', 'email'],
  codice_fiscale: ['users', 'codice_fiscale'],
  partita_iva: ['user_business_profiles', 'partita_iva'],
  iban: ['user_business_profiles', 'iban'],
  numero_albo: ['professional_credentials', 'numero_albo'],
} as const;

export function createAvailabilityHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    const field = String(req.body?.field || '') as keyof typeof availabilityMap;
    const value = String(req.body?.value || '').trim();
    const config = availabilityMap[field];
    if (!config || !value) return res.status(422).json({ error: 'VALIDATION_FAILED' });
    const [table, column] = config;
    const { data } = await db.from(table).select('id,user_id').eq(column, value).maybeSingle();
    return res.json({ available: !data });
  };
}

export function createRegisterRouter(db: SupabaseLike): Router {
  const router = Router();
  router.post('/register', createRegisterHandler(db));
  router.post('/register/availability', createAvailabilityHandler(db));
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
