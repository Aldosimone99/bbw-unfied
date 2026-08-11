import { createConsentTemplateSchema, updateConsentTemplateSchema } from '@bbw/interfaces';
import { Router } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  ConsentTemplateError,
  createTemplate,
  deactivateTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '../services/consent-template-service';

function handle(res: any, error: unknown) {
  if (error instanceof ConsentTemplateError) return res.status(error.statusCode).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'CONSENT_TEMPLATE_FAILED' });
}

export function createConsentTemplatesRouter(db: SupabaseLike): Router {
  const router = Router();
  router.use(resolveUser(db));

  router.get('/', async (req, res) => {
    try {
      const data = await listTemplates(db, req.user!.id, req.companyId ?? null, {
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 20),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.post('/', async (req, res) => {
    try {
      const parsed = createConsentTemplateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await createTemplate(db, {
        ownerId: req.user!.id,
        ownerType: req.user!.tipo_utente as 'medico' | 'estetista',
        companyId: req.companyId ?? null,
        ...parsed.data,
      });
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      return res.json({ success: true, data: await getTemplate(db, req.params.id, req.user!.id) });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const parsed = updateConsentTemplateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      return res.json({ success: true, data: await updateTemplate(db, req.params.id, req.user!.id, parsed.data) });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await deactivateTemplate(db, req.params.id, req.user!.id);
      return res.json({ success: true });
    } catch (error) {
      return handle(res, error);
    }
  });

  return router;
}
