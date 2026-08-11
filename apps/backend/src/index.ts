import cors from 'cors';
import express from 'express';
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
import { resolveCompanyContext } from './middleware/resolve-company-context-middleware';

export function createApp(db = createSupabaseServerClient()) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(resolveCompanyContext);
  app.use('/auth', createAuthRouter(db));
  app.use('/invites', createInvitesRouter(db));
  app.use('/company/invites', createCompanyInvitesRouter(db));
  app.use('/referrals', createReferralsRouter(db));
  app.use('/commerciale-contract', createCommercialeContractRouter(db, () => null));
  app.use('/professional-contract', createProfessionalContractRouter(db, () => null));
  app.use('/professional-documents', createProfessionalDocumentsRouter(db, () => null));
  app.use('/onboarding', createOnboardingRouter(db, () => null));
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
