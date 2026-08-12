import { Router } from 'express';
import {
  professionalProfileCreateSchema,
  professionalProfileUpdateSchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  createOwnProfessionalProfile,
  listOwnProfessionalProfiles,
  listProfessionalTypes,
  ProfessionalProfileError,
  requestProfessionalVerification,
  updateOwnProfessionalProfile,
} from '../services/professional-profile-service';

function handleError(res: any, error: unknown) {
  if (error instanceof ProfessionalProfileError) return res.status(error.status).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'PROFESSIONAL_PROFILE_FAILED' });
}

export function createProfessionalProfileRouter(db: SupabaseLike): Router {
  const router = Router();
  const requireUser = resolveUser(db);

  router.get('/types', requireUser, async (_req, res) => {
    try { return res.json({ success: true, data: await listProfessionalTypes(db) }); }
    catch (error) { return handleError(res, error); }
  });

  router.get('/me', requireUser, async (req, res) => {
    try { return res.json({ success: true, data: await listOwnProfessionalProfiles(db, req.user!.id) }); }
    catch (error) { return handleError(res, error); }
  });

  router.post('/me', requireUser, async (req, res) => {
    const parsed = professionalProfileCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try { return res.status(201).json({ success: true, data: await createOwnProfessionalProfile(db, req.user!.id, parsed.data) }); }
    catch (error) { return handleError(res, error); }
  });

  router.patch('/me/:profileId', requireUser, async (req, res) => {
    const parsed = professionalProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try { return res.json({ success: true, data: await updateOwnProfessionalProfile(db, req.user!.id, String(req.params.profileId), parsed.data) }); }
    catch (error) { return handleError(res, error); }
  });

  router.post('/me/:profileId/request-verification', requireUser, async (req, res) => {
    try { return res.json({ success: true, data: await requestProfessionalVerification(db, req.user!.id, String(req.params.profileId)) }); }
    catch (error) { return handleError(res, error); }
  });

  return router;
}
