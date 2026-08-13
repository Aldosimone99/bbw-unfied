import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createPatientRelationshipRequestSchema,
  operationalContextReferenceSchema,
  patientLookupRequestSchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  createPatientRelationship,
  getPatientRelationship,
  listPatientRelationships,
  lookupPatient,
  PatientRelationshipError,
  removePatientRelationship,
} from '../services/patient-relationship-service';

function contextFromRequest(req: Request) {
  const kind = req.header('x-operational-context-kind');
  const id = req.header('x-operational-context-id');
  const parsed = operationalContextReferenceSchema.safeParse({ kind, id });
  if (!parsed.success) throw new PatientRelationshipError('OPERATIONAL_CONTEXT_REQUIRED', 422);
  return parsed.data;
}

function relationshipIdFromRequest(req: Request): string {
  const value = String(req.params.relationshipId ?? '');
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new PatientRelationshipError('VALIDATION_FAILED', 422);
  return parsed.data;
}

function handleError(res: Response, error: unknown) {
  if (error instanceof PatientRelationshipError) return res.status(error.status).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'PATIENT_OPERATION_FAILED' });
}

export function createPatientRelationshipRouter(db: SupabaseLike): Router {
  const router = Router();

  router.get('/', resolveUser(db), async (req, res) => {
    try {
      return res.json({ success: true, data: await listPatientRelationships(db, req.user!, contextFromRequest(req)) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.post('/lookup', resolveUser(db), async (req, res) => {
    const parsed = patientLookupRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      return res.json({ success: true, data: await lookupPatient(db, req.user!, contextFromRequest(req), parsed.data) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.post('/relationships', resolveUser(db), async (req, res) => {
    const parsed = createPatientRelationshipRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      return res.json({ success: true, data: await createPatientRelationship(db, req.user!, contextFromRequest(req), parsed.data) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.get('/relationships/:relationshipId', resolveUser(db), async (req, res) => {
    try {
      return res.json({ success: true, data: await getPatientRelationship(db, req.user!, contextFromRequest(req), relationshipIdFromRequest(req)) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.delete('/relationships/:relationshipId', resolveUser(db), async (req, res) => {
    try {
      return res.json({ success: true, data: await removePatientRelationship(db, req.user!, contextFromRequest(req), relationshipIdFromRequest(req)) });
    } catch (error) {
      return handleError(res, error);
    }
  });

  return router;
}
