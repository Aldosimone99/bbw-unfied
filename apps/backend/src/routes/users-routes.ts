import { Router } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import { getPublicProfessionalProfile, PublicProfileError } from '../services/public-profile-service';
import { listUserCompanies } from '../services/user-companies-service';

export function createUsersRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/me/companies', resolveUser(db), async (req, res) => {
    try {
      const data = await listUserCompanies(db, req.user!.id);
      return res.json({ success: true, data });
    } catch {
      return res.status(500).json({ success: false, code: 'LIST_USER_COMPANIES_FAILED' });
    }
  });

  router.get('/profile/:slug', async (req, res) => {
    try {
      const data = await getPublicProfessionalProfile(db, String(req.params.slug ?? ''));
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof PublicProfileError) return res.status(error.statusCode).json({ success: false, code: error.code });
      return res.status(500).json({ success: false, code: 'PUBLIC_PROFILE_FAILED' });
    }
  });

  return router;
}
