import { Router, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { ReferralCodeError, resolveReferralCode } from '../services/referral-code-service';

export function createReferralsRouter(db: SupabaseLike): Router {
  const router = Router();
  router.get('/context', createReferralContextHandler(db));
  return router;
}

export function createReferralContextHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const code = String(req.query.ref || req.query.medico || req.query.estetista || req.query.clinica || req.query.commerciale || '').trim();
      if (!code) return res.status(422).json({ success: false, code: 'REFERRAL_CODE_REQUIRED' });
      const data = await resolveReferralCode(db, code);
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof ReferralCodeError) return res.status(error.status).json({ success: false, code: error.code });
      return res.status(500).json({ success: false, code: 'REFERRAL_CONTEXT_FAILED' });
    }
  };
}
