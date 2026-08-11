import { Router } from 'express';
import type { SupabaseLike } from '../../db/supabase';
import { createRegisterValidateController } from '../../controllers/auth/register-validate-controller';

export function createRegisterValidateRouter(db: SupabaseLike): Router {
  const router = Router();
  const ctrl = createRegisterValidateController(db);
  router.post('/register/validate/personal', ctrl.personal);
  router.post('/register/validate/address', ctrl.address);
  router.post('/register/validate/professional', ctrl.professional);
  router.post('/register/validate/business', ctrl.business);
  router.post('/register/validate/password', ctrl.password);
  return router;
}
