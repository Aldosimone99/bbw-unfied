import { Router, type Response } from 'express';
import { onboardingCompletionRequestSchema, onboardingProfileRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { resolveUser } from '../../middleware/resolve-user-middleware';
import {
  AccountOnboardingError,
  completeAccountOnboarding,
  saveAccountProfile,
} from '../../services/account-onboarding-service';

function handleOnboardingError(res: Response, error: unknown) {
  if (error instanceof AccountOnboardingError) {
    const status = error.code === 'ONBOARDING_NOT_FOUND' ? 404 : error.code === 'ONBOARDING_ALREADY_COMPLETED' ? 409 : 500;
    return res.status(status).json({ error: error.code });
  }
  return res.status(500).json({ error: 'ONBOARDING_UPDATE_FAILED' });
}

export function createOnboardingAuthRouter(db: SupabaseLike): Router {
  const router = Router();

  router.post('/onboarding/profile', resolveUser(db), async (req, res) => {
    const parsed = onboardingProfileRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });

    try {
      await saveAccountProfile(db, req.user!.id, parsed.data);
      return res.json({ success: true });
    } catch (error) {
      return handleOnboardingError(res, error);
    }
  });

  router.post('/onboarding/complete', resolveUser(db), async (req, res) => {
    const parsed = onboardingCompletionRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });

    try {
      await completeAccountOnboarding(db, req.user!.id, parsed.data);
      return res.json({ success: true });
    } catch (error) {
      return handleOnboardingError(res, error);
    }
  });

  return router;
}
