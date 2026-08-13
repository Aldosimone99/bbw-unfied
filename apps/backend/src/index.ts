import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createSupabaseServerClient } from './db/supabase';
import { createAuthRouter } from './routes/auth';
import { createInvitesRouter } from './routes/invites-routes';
import { createCompanyInvitesRouter } from './routes/company-invites-routes';
import { createReferralsRouter } from './routes/referrals-routes';
import { createCommercialeContractRouter } from './routes/commerciale-contract-routes';
import { createProfessionalContractRouter } from './routes/professional-contract-routes';
import { createProfessionalDocumentsRouter } from './routes/professional-documents-routes';
import { createOnboardingRouter } from './routes/onboarding-routes';
import { createAdminRouter } from './routes/admin/users-routes';
import { createAddressRouter } from './routes/address-routes';
import { createNotificationsRouter } from './routes/notifications-routes';
import { createMessagesRouter } from './routes/messages-routes';
import { createPPLRouter } from './routes/ppl-routes';
import { createAvailabilityRouter } from './routes/availability-routes';
import { createBookingsRouter } from './routes/bookings-routes';
import { createSlotsRouter } from './routes/slots-routes';
import { createCatalogRouter } from './routes/catalog';
import { createConsentTemplatesRouter } from './routes/consent-templates-routes';
import { createConsentDocumentsRouter } from './routes/consent-documents-routes';
import { createUsersRouter } from './routes/users-routes';
import { createProfessionalProfileRouter } from './routes/professional-profile-routes';
import { createOrganizationProfileRouter } from './routes/organization-profile-routes';
import { createOrganizationMembersRouter } from './routes/organization-members-routes';
import { createPatientRelationshipRouter } from './routes/patient-relationship-routes';
import { resolveCompanyContext } from './middleware/resolve-company-context-middleware';
import { resolveUser } from './middleware/resolve-user-middleware';

function resolveVerifiedRouteUser(req: Request) {
  return req.user ?? null;
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function allowedOrigins(): Set<string> {
  const configured = process.env.CORS_ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
  const frontend = process.env.FRONTEND_URL?.trim();
  if (frontend) configured.push(frontend);
  if (configured.length === 0 && process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:3000');
  }
  return new Set(configured);
}

export function createApp(db = createSupabaseServerClient()) {
  const app = express();
  const origins = allowedOrigins();
  const enableLegacyRoutes = enabled(process.env.ENABLE_LEGACY_TRANSITION_ROUTES);

  app.disable('x-powered-by');
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || origins.has(origin)) return callback(null, true);
      return callback(new Error('CORS_ORIGIN_FORBIDDEN'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Company-Id', 'X-Request-Id'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? '1mb' }));
  app.use(resolveCompanyContext);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', createAuthRouter(db, { enableLegacyRoutes }));
  app.use('/company/invites', createCompanyInvitesRouter(db));
  app.use('/professional-profile', createProfessionalProfileRouter(db));
  app.use('/organizations', createOrganizationProfileRouter(db));
  app.use('/organization/members', createOrganizationMembersRouter(db));
  app.use('/patients', createPatientRelationshipRouter(db));

  if (enableLegacyRoutes) {
    app.use('/invites', createInvitesRouter(db));
    app.use('/referrals', createReferralsRouter(db));
    app.use('/commerciale-contract', resolveUser(db), createCommercialeContractRouter(db, resolveVerifiedRouteUser));
    app.use('/professional-contract', resolveUser(db), createProfessionalContractRouter(db, resolveVerifiedRouteUser));
    app.use('/professional-documents', resolveUser(db), createProfessionalDocumentsRouter(db, resolveVerifiedRouteUser));
    app.use('/onboarding', resolveUser(db), createOnboardingRouter(db, resolveVerifiedRouteUser));
    app.use('/admin', createAdminRouter(db));
    app.use('/notifications', createNotificationsRouter(db));
    app.use('/messages', createMessagesRouter(db));
    app.use('/ppl/invites', createPPLRouter(db));
    app.use('/bookings', createBookingsRouter(db));
    app.use('/availability', createAvailabilityRouter(db));
    app.use('/slots', createSlotsRouter(db));
    app.use('/catalog', createCatalogRouter(db));
    app.use('/consent-templates', createConsentTemplatesRouter(db));
    app.use('/consents', createConsentDocumentsRouter(db));
    app.use('/users', createUsersRouter(db));
    app.use('/address', createAddressRouter());
  }

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof Error && error.message === 'CORS_ORIGIN_FORBIDDEN') {
      return res.status(403).json({ success: false, code: 'CORS_ORIGIN_FORBIDDEN' });
    }
    return next(error);
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });

  const port = Number(process.env.PORT ?? 3001);
  createApp().listen(port, () => {
    console.log(`BBW backend listening on ${port}`);
  });
}
