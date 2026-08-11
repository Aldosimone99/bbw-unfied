import { Router } from 'express';
import { profileUpdateSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { resolveUser } from '../../middleware/resolve-user-middleware';
import { getCurrentUserProfile, ProfileAccessError, updateCurrentUserProfile } from '../../services/profile-service';
import { getAuthorizationContext } from '../../services/authorization-context-service';

export function createMeRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/me', resolveUser(db), async (req, res) => {
    const profile = await getCurrentUserProfile(db, req.user!.id);
    return res.json(profile);
  });

  router.get('/context', resolveUser(db), async (req, res) => {
    try {
      return res.json(await getAuthorizationContext(db, req.user!));
    } catch {
      return res.status(500).json({ error: 'AUTHORIZATION_CONTEXT_FAILED' });
    }
  });

  router.put('/me', resolveUser(db), async (req, res) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });

    try {
      const profile = await updateCurrentUserProfile(db, req.user!, parsed.data);
      return res.json(profile);
    } catch (error) {
      if (error instanceof ProfileAccessError) return res.status(error.status).json({ error: error.code });
      return res.status(500).json({ error: 'PROFILE_UPDATE_FAILED' });
    }
  });

  return router;
}
