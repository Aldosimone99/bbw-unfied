import { addConsentVersionSchema, requestOTPSchema, revokeConsentSchema, signConsentSchema } from '@bbw/interfaces';
import { Router } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import { defaultEmailService } from '../services/email-service';
import * as consentDocumentService from '../services/consent-document-service';
import { ConsentDocumentError } from '../services/consent-document-service';
import { ConsentSigningError, requestOTP, sign } from '../services/consent-signing-service';

function handle(res: any, error: unknown) {
  if (error instanceof ConsentDocumentError || error instanceof ConsentSigningError) return res.status(error.statusCode).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'CONSENT_FAILED' });
}

function requestMeta(req: any) {
  return {
    ipAddress: req.ip ?? '0.0.0.0',
    userAgent: String(req.headers['user-agent'] ?? ''),
  };
}

export function createConsentDocumentsRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/view/:token', async (req, res) => {
    try {
      return res.json({ success: true, data: await consentDocumentService.getDocumentByToken(db, req.params.token) });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.use(resolveUser(db));

  router.get('/', async (req, res) => {
    try {
      const data = await consentDocumentService.listDocuments(db, req.user!.id, req.companyRole ?? req.user!.tipo_utente, req.companyId ?? null, {
        status: req.query.status ? String(req.query.status) : undefined,
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 20),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      return res.json({ success: true, data: await consentDocumentService.getDocument(db, req.params.id, req.user!.id) });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.post('/:id/versions', async (req, res) => {
    try {
      const parsed = addConsentVersionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      return res.status(201).json({ success: true, data: await consentDocumentService.addVersion(db, req.params.id, req.user!.id, parsed.data) });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.post('/:id/share', async (req, res) => {
    try {
      return res.status(201).json({ success: true, data: await consentDocumentService.generateShareToken(db, req.params.id, req.user!.id, defaultEmailService) });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.post('/:id/otp/request', async (req, res) => {
    try {
      const parsed = requestOTPSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const meta = requestMeta(req);
      const data = await requestOTP(db, {
        consentId: req.params.id,
        userId: req.user!.id,
        email: req.user!.email,
        requestIp: meta.ipAddress,
        requestUserAgent: meta.userAgent,
        requestDeviceFingerprint: parsed.data.deviceFingerprint,
      }, defaultEmailService);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.post('/:id/sign', async (req, res) => {
    try {
      const parsed = signConsentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const meta = requestMeta(req);
      const data = await sign(db, {
        consentId: req.params.id,
        signerId: req.user!.id,
        signerRole: req.body.signerRole ?? 'client',
        signerName: [req.user!.nome, req.user!.cognome].filter(Boolean).join(' ') || req.user!.email,
        signerEmail: req.user!.email,
        ...parsed.data,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }, consentDocumentService);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(res, error);
    }
  });

  router.post('/:id/revoke', async (req, res) => {
    try {
      const parsed = revokeConsentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      await consentDocumentService.revokeDocument(db, req.params.id, req.user!.id, parsed.data.reason);
      return res.json({ success: true });
    } catch (error) {
      return handle(res, error);
    }
  });

  return router;
}
