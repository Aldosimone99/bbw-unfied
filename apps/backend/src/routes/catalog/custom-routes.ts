import { Router } from 'express';
import { createCustomServiceRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { resolveUser } from '../../middleware/resolve-user-middleware';
import { createCustomService, deleteCustomService, listCustomServices, updateCustomService } from '../../services/custom-services-service';

export function createCustomCatalogRouter(db: SupabaseLike): Router {
  const router = Router();

  router.use(resolveUser(db));

  router.get('/', async (req, res) => {
    const data = await listCustomServices(db, String(req.user?.id ?? ''));
    return res.json({ success: true, data });
  });

  router.post('/', async (req, res) => {
    const payload = createCustomServiceRequestSchema.parse(req.body);
    const data = await createCustomService(db, req.user, payload, req.companyId ?? undefined);
    return res.status(201).json({ success: true, data });
  });

  router.put('/:id', async (req, res) => {
    const payload = createCustomServiceRequestSchema.partial().parse(req.body);
    const data = await updateCustomService(db, String(req.user?.id ?? ''), String(req.params.id), payload);
    return res.json({ success: true, data });
  });

  router.delete('/:id', async (req, res) => {
    await deleteCustomService(db, String(req.user?.id ?? ''), String(req.params.id));
    return res.json({ success: true });
  });

  return router;
}
