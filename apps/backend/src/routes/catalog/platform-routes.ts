import { Router } from 'express';
import type { SupabaseLike } from '../../db/supabase';
import { CatalogError, getPlatformTreatment, listPlatformTreatments } from '../../services/platform-catalog-service';

function handleCatalogError(res: any, error: unknown) {
  if (error instanceof CatalogError) return res.status(error.status).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'CATALOG_FAILED' });
}

export function createPlatformCatalogRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const data = await listPlatformTreatments(db, req.user ?? null, { category: req.query.category ? String(req.query.category) : undefined });
      return res.json({ success: true, data });
    } catch (error) {
      return handleCatalogError(res, error);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const data = await getPlatformTreatment(db, req.user ?? null, String(req.params.id));
      return res.json({ success: true, data });
    } catch (error) {
      return handleCatalogError(res, error);
    }
  });

  return router;
}
