import { Router } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { getAvailableDays, getAvailableSlots, SlotsError } from '../services/slots-service';

function handleSlotsError(res: any, error: unknown) {
  if (error instanceof SlotsError) return res.status(error.statusCode).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'SLOTS_FAILED' });
}

export function createSlotsRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/days', async (req, res) => {
    try {
      const professionalId = String(req.query.professionalId ?? '');
      if (!professionalId) return res.status(400).json({ success: false, code: 'PROFESSIONAL_ID_REQUIRED' });
      const from = String(req.query.from ?? '');
      const to = String(req.query.to ?? '');
      const data = await getAvailableDays(db, professionalId, req.companyId, { from, to });
      return res.json({ success: true, data });
    } catch (error) {
      return handleSlotsError(res, error);
    }
  });

  router.get('/', async (req, res) => {
    try {
      const professionalId = String(req.query.professionalId ?? '');
      if (!professionalId) return res.status(400).json({ success: false, code: 'PROFESSIONAL_ID_REQUIRED' });
      const date = String(req.query.date ?? '');
      const data = await getAvailableSlots(db, professionalId, req.companyId, date);
      return res.json({ success: true, data });
    } catch (error) {
      return handleSlotsError(res, error);
    }
  });

  return router;
}
