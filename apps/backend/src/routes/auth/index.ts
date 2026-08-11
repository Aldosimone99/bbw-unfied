import { Router } from 'express';
import type { SupabaseLike } from '../../db/supabase';
import { createLoginRouter } from './login-routes';
import { createMeRouter } from './me-routes';
import { createRegisterRouter } from './register-routes';
import { createPasswordRouter } from './password-routes';
import { createOtpRouter } from './otp-routes';
import { createTokenRouter } from './token-routes';
import { createRegisterValidateRouter } from './register-validate-routes';

export function createAuthRouter(db: SupabaseLike): Router {
  const router = Router();
  router.use(createRegisterRouter(db));
  router.use(createRegisterValidateRouter(db));
  router.use(createLoginRouter(db));
  router.use(createMeRouter(db));
  router.use(createPasswordRouter(db));
  router.use(createOtpRouter(db));
  router.use(createTokenRouter(db));
  return router;
}
