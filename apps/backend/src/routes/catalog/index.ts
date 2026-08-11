import { Router } from 'express';
import type { SupabaseLike } from '../../db/supabase';
import { createPlatformCatalogRouter } from './platform-routes';
import { createCompanyCatalogRouter } from './company-routes';
import { createAssignmentsCatalogRouter } from './assignments-routes';
import { createCustomCatalogRouter } from './custom-routes';

export function createCatalogRouter(db: SupabaseLike): Router {
  const router = Router();
  router.use('/platform', createPlatformCatalogRouter(db));
  router.use('/company', createCompanyCatalogRouter(db));
  router.use('/assignments', createAssignmentsCatalogRouter(db));
  router.use('/custom', createCustomCatalogRouter(db));
  return router;
}
