import type { NextFunction, Request, Response } from 'express';
import { createInviteRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { createEmailService } from '../services/email-service';
import {
  createInvite,
  InviteError,
  listInvites,
  resendInvite,
  revokeInvite,
} from '../services/invite-service';

function userOrThrow(req: Request) {
  if (!req.user) throw new InviteError('UNAUTHENTICATED', 401);
  return req.user;
}

export function handleInviteError(res: Response, error: unknown) {
  if (error instanceof InviteError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      ...(error.code === 'INVITE_EMAIL_ALREADY_EXISTS' ? { exists: true } : {}),
    });
  }
  return res.status(500).json({ success: false, code: 'INVITE_REQUEST_FAILED' });
}

export function createInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const user = userOrThrow(req);
      const payload = createInviteRequestSchema.parse(req.body);
      const data = await createInvite(db, user.id, user.tipo_utente, payload, {
        force: payload.force,
        emailService: createEmailService(),
      });
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleInviteError(res, error);
    }
  };
}

export function listInvitesHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const user = userOrThrow(req);
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const data = await listInvites(db, user.id, { page, limit });
      return res.json({ success: true, data });
    } catch (error) {
      return handleInviteError(res, error);
    }
  };
}

export function revokeInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const user = userOrThrow(req);
      await revokeInvite(db, String(req.params.id), user.id);
      return res.json({ success: true });
    } catch (error) {
      return handleInviteError(res, error);
    }
  };
}

export function resendInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const user = userOrThrow(req);
      const data = await resendInvite(db, String(req.params.id), user.id, createEmailService());
      return res.json({ success: true, data });
    } catch (error) {
      return handleInviteError(res, error);
    }
  };
}
