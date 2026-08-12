import { Router } from 'express';
import {
  personalProfileUpdateRequestSchema,
  readinessContextQuerySchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { resolveUser } from '../../middleware/resolve-user-middleware';
import { getCurrentUserProfile, ProfileAccessError, updateCurrentUserProfile } from '../../services/profile-service';
import { getAuthorizationContext } from '../../services/authorization-context-service';

export function createMeRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/me', resolveUser(db), async (req, res) => {
    try {
      return res.json(await getCurrentUserProfile(db, req.user!.id));
    } catch (error) {
      if (error instanceof ProfileAccessError) return res.status(error.status).json({ error: error.code });
      return res.status(500).json({ error: 'PROFILE_READ_FAILED' });
    }
  });

  router.get('/context', resolveUser(db), async (req, res) => {
    const parsed = readinessContextQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });

    try {
      return res.json(await getAuthorizationContext(db, req.user!, {
        requestedOrganizationId: parsed.data.organization_id,
      }));
    } catch {
      return res.status(500).json({ error: 'AUTHORIZATION_CONTEXT_FAILED' });
    }
  });

  router.put('/me', resolveUser(db), async (req, res) => {
    const parsed = personalProfileUpdateRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });

    try {
      return res.json(await updateCurrentUserProfile(db, req.user!, parsed.data));
    } catch (error) {
      if (error instanceof ProfileAccessError) return res.status(error.status).json({ error: error.code });
      return res.status(500).json({ error: 'PROFILE_UPDATE_FAILED' });
    }
  });

  return router;
}
