import { Router } from 'express';
import { adoptTreatmentRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../../db/supabase';
import { resolveUser } from '../../middleware/resolve-user-middleware';
import { requireCompanyRole } from '../../middleware/require-company-role-middleware';
import { adoptTreatment, deactivateCompanyCatalogItem, listCompanyCatalog, updateCompanyCatalogItem } from '../../services/company-catalog-service';

export function createCompanyCatalogRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/', resolveUser(db), requireCompanyRole(db, ['owner', 'admin', 'staff', 'profissional']), async (req, res) => {
    const data = await listCompanyCatalog(db, req.companyId ?? '');
    return res.json({ success: true, data });
  });

  router.post('/adopt', resolveUser(db), requireCompanyRole(db, ['owner', 'admin']), async (req, res) => {
    const payload = adoptTreatmentRequestSchema.parse(req.body);
    const data = await adoptTreatment(db, req.companyId ?? '', payload);
    return res.status(201).json({ success: true, data });
  });

  router.put('/:id', resolveUser(db), requireCompanyRole(db, ['owner', 'admin']), async (req, res) => {
    const payload = adoptTreatmentRequestSchema.partial().parse(req.body);
    const data = await updateCompanyCatalogItem(db, req.companyId ?? '', String(req.params.id), payload);
    return res.json({ success: true, data });
  });

  router.delete('/:id', resolveUser(db), requireCompanyRole(db, ['owner', 'admin']), async (req, res) => {
    await deactivateCompanyCatalogItem(db, req.companyId ?? '', String(req.params.id));
    return res.json({ success: true });
  });

  return router;
}
