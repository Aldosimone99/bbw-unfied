import { Router } from 'express';
import type { SupabaseLike } from '../../db/supabase';
import { resolveUser } from '../../middleware/resolve-user-middleware';
import { requireRole } from '../../middleware/require-role-middleware';
import { listAllUsers } from '../../services/admin-service';

export function createAdminRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/users', resolveUser(db), requireRole('admin'), async (_req, res) => {
    try {
      const users = await listAllUsers(db);
      return res.json({ success: true, data: users });
    } catch (err) {
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  return router;
}
