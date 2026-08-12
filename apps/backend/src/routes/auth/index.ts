import { Router } from 'express';
import type { SupabaseLike } from '../../db/supabase';
import { createLoginRouter } from './login-routes';
import { createMeRouter } from './me-routes';
import { createRegisterRouter } from './register-routes';
import { createPasswordRouter } from './password-routes';
import { createOtpRouter } from './otp-routes';
import { createTokenRouter } from './token-routes';
import { createRegisterValidateRouter } from './register-validate-routes';
import { createOnboardingAuthRouter } from './onboarding-routes';

type AuthRouterOptions = {
  enableLegacyRoutes?: boolean;
};

export function createAuthRouter(db: SupabaseLike, options: AuthRouterOptions = {}): Router {
  const router = Router();
  router.use(createRegisterRouter(db));
  router.use(createOnboardingAuthRouter(db));
  router.use(createLoginRouter(db));
  router.use(createMeRouter(db));

  if (options.enableLegacyRoutes) {
    router.use(createRegisterValidateRouter(db));
    router.use(createPasswordRouter(db));
    router.use(createOtpRouter(db));
    router.use(createTokenRouter(db));
  }

  return router;
}
