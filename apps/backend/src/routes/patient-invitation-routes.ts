import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createPatientInvitationRequestSchema,
  operationalContextReferenceSchema,
  patientInvitationAcceptRequestSchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  acceptPatientInvitation,
  createPatientInvitation,
  createPatientInvitationLink,
  listPatientInvitations,
  lookupPatientInvitation,
  PatientInvitationError,
  revokePatientInvitation,
} from '../services/patient-invitation-service';

function contextFromRequest(req: Request) {
  const parsed = operationalContextReferenceSchema.safeParse({
    kind: req.header('x-operational-context-kind'),
    id: req.header('x-operational-context-id'),
  });
  if (!parsed.success || parsed.data.kind !== 'organization') {
    throw new PatientInvitationError('OPERATIONAL_CONTEXT_REQUIRED', 422);
  }
  return parsed.data;
}

function invitationIdFromRequest(req: Request): string {
  const parsed = z.string().uuid().safeParse(req.params.invitationId);
  if (!parsed.success) throw new PatientInvitationError('VALIDATION_FAILED', 422);
  return parsed.data;
}

function handleError(res: Response, error: unknown) {
  if (error instanceof PatientInvitationError) {
    return res.status(error.status).json({ success: false, code: error.code });
  }
  return res.status(500).json({ success: false, code: 'PATIENT_INVITATION_OPERATION_FAILED' });
}

export function createPatientInvitationRouter(db: SupabaseLike): Router {
  const router = Router();

  router.post('/lookup', async (req, res) => {
    const parsed = patientInvitationAcceptRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      return res.json({ success: true, data: await lookupPatientInvitation(db, parsed.data.token) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.post('/accept', resolveUser(db), async (req, res) => {
    const parsed = patientInvitationAcceptRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      return res.json({ success: true, data: await acceptPatientInvitation(db, parsed.data.token, req.user!) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.post('/', resolveUser(db), async (req, res) => {
    const parsed = createPatientInvitationRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      return res.status(201).json({ success: true, data: await createPatientInvitation(db, req.user!, contextFromRequest(req), parsed.data) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.get('/', resolveUser(db), async (req, res) => {
    try {
      return res.json({ success: true, data: await listPatientInvitations(db, req.user!, contextFromRequest(req)) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.post('/:invitationId/link', resolveUser(db), async (req, res) => {
    try {
      return res.json({
        success: true,
        data: await createPatientInvitationLink(db, req.user!, contextFromRequest(req), invitationIdFromRequest(req)),
      });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.delete('/:invitationId', resolveUser(db), async (req, res) => {
    try {
      return res.json({ success: true, data: await revokePatientInvitation(db, req.user!, contextFromRequest(req), invitationIdFromRequest(req)) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  return router;
}
