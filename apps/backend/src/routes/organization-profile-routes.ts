import { Router, type Response } from 'express';
import {
  organizationIdParamSchema,
  organizationProfileUpdateRequestSchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  getCurrentOrganizationProfile,
  OrganizationProfileError,
  updateCurrentOrganizationProfile,
} from '../services/organization-profile-service';

function handleOrganizationProfileError(res: Response, error: unknown) {
  if (error instanceof OrganizationProfileError) {
    return res.status(error.status).json({ error: error.code });
  }
  return res.status(500).json({ error: 'ORGANIZATION_PROFILE_FAILED' });
}

export function createOrganizationProfileRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/:organizationId/profile', resolveUser(db), async (req, res) => {
    const params = organizationIdParamSchema.safeParse({ organization_id: req.params.organizationId });
    if (!params.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: params.error.issues });

    try {
      return res.json({ data: await getCurrentOrganizationProfile(db, req.user!, params.data.organization_id) });
    } catch (error) {
      return handleOrganizationProfileError(res, error);
    }
  });

  router.put('/:organizationId/profile', resolveUser(db), async (req, res) => {
    const params = organizationIdParamSchema.safeParse({ organization_id: req.params.organizationId });
    const payload = organizationProfileUpdateRequestSchema.safeParse(req.body);
    const issues = !params.success
      ? params.error.issues
      : !payload.success
        ? payload.error.issues
        : [];
    if (!params.success || !payload.success) {
      return res.status(422).json({ error: 'VALIDATION_FAILED', issues });
    }

    try {
      return res.json({ data: await updateCurrentOrganizationProfile(db, req.user!, params.data.organization_id, payload.data) });
    } catch (error) {
      return handleOrganizationProfileError(res, error);
    }
  });

  return router;
}
