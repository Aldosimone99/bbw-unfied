import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  catalogFiltersSchema,
  createCustomTreatmentRequestSchema,
  createTreatmentOfferingRequestSchema,
  operationalContextReferenceSchema,
  updateTreatmentOfferingRequestSchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  CatalogServiceError,
  createCustomTreatment,
  createTreatmentOffering,
  listCatalogCategories,
  listCatalogTreatments,
  listTreatmentOfferings,
  removeTreatmentOffering,
  updateTreatmentOffering,
} from '../services/catalog-service';

function contextFromRequest(req: Request) {
  const parsed = operationalContextReferenceSchema.safeParse({
    kind: req.header('x-operational-context-kind'),
    id: req.header('x-operational-context-id'),
  });
  if (!parsed.success) throw new CatalogServiceError('OPERATIONAL_CONTEXT_REQUIRED', 422);
  return parsed.data;
}

function offeringIdFromRequest(req: Request): string {
  const parsed = z.string().uuid().safeParse(req.params.offeringId);
  if (!parsed.success) throw new CatalogServiceError('VALIDATION_FAILED', 422);
  return parsed.data;
}

function filtersFromRequest(req: Request) {
  const query = {
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    categoryCode: typeof req.query.categoryCode === 'string' ? req.query.categoryCode : undefined,
    bodyArea: typeof req.query.bodyArea === 'string' ? req.query.bodyArea : undefined,
  };
  const parsed = catalogFiltersSchema.safeParse(query);
  if (!parsed.success) throw new CatalogServiceError('VALIDATION_FAILED', 422);
  return parsed.data;
}

function handleError(res: Response, error: unknown) {
  if (error instanceof CatalogServiceError) {
    return res.status(error.status).json({ success: false, code: error.code });
  }
  return res.status(500).json({ success: false, code: 'CATALOG_OPERATION_FAILED' });
}

export function createCatalogRoutes(db: SupabaseLike): Router {
  const router = Router();

  router.get('/categories', resolveUser(db), async (req, res) => {
    try {
      const items = await listCatalogCategories(db, req.user!, contextFromRequest(req));
      return res.json({ success: true, data: { items, total: items.length } });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.get('/treatments', resolveUser(db), async (req, res) => {
    try {
      const items = await listCatalogTreatments(db, req.user!, contextFromRequest(req), filtersFromRequest(req));
      return res.json({ success: true, data: { items, total: items.length } });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.get('/offerings', resolveUser(db), async (req, res) => {
    try {
      const items = await listTreatmentOfferings(db, req.user!, contextFromRequest(req));
      return res.json({ success: true, data: { items, total: items.length } });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.post('/treatments/custom', resolveUser(db), async (req, res) => {
    const parsed = createCustomTreatmentRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      return res.status(201).json({ success: true, data: await createCustomTreatment(db, req.user!, contextFromRequest(req), parsed.data) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.post('/offerings', resolveUser(db), async (req, res) => {
    const parsed = createTreatmentOfferingRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      return res.status(201).json({ success: true, data: await createTreatmentOffering(db, req.user!, contextFromRequest(req), parsed.data) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.patch('/offerings/:offeringId', resolveUser(db), async (req, res) => {
    const parsed = updateTreatmentOfferingRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      return res.json({ success: true, data: await updateTreatmentOffering(db, req.user!, contextFromRequest(req), offeringIdFromRequest(req), parsed.data) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.delete('/offerings/:offeringId', resolveUser(db), async (req, res) => {
    try {
      return res.json({ success: true, data: await removeTreatmentOffering(db, req.user!, contextFromRequest(req), offeringIdFromRequest(req)) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  return router;
}
