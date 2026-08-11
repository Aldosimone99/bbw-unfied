import { Router } from 'express';
import { createAssignmentRequestSchema, updateAssignmentRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { resolveUser } from '../../middleware/resolve-user-middleware';
import { acceptDisclaimer, createAssignment, deactivateAssignment, listAssignments, updateAssignment } from '../../services/professional-catalog-service';

function userId(req: any): string {
  return String(req.user?.id ?? '');
}

export function createAssignmentsCatalogRouter(db: SupabaseLike): Router {
  const router = Router();

  router.use(resolveUser(db));

  router.get('/', async (req, res) => {
    const data = await listAssignments(db, userId(req));
    return res.json({ success: true, data });
  });

  router.post('/', async (req, res) => {
    const payload = createAssignmentRequestSchema.parse(req.body);
    const data = await createAssignment(db, userId(req), req.user, payload);
    return res.status(201).json({ success: true, data });
  });

  router.put('/:id', async (req, res) => {
    const payload = updateAssignmentRequestSchema.parse(req.body);
    const data = await updateAssignment(db, userId(req), String(req.params.id), payload);
    return res.json({ success: true, data });
  });

  router.delete('/:id', async (req, res) => {
    await deactivateAssignment(db, userId(req), String(req.params.id));
    return res.json({ success: true });
  });

  router.post('/:id/disclaimer', async (req, res) => {
    await acceptDisclaimer(db, userId(req), String(req.params.id));
    return res.json({ success: true });
  });

  return router;
}
