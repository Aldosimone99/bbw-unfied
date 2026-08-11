import type { Request, Response } from 'express';
import { createCompanyInviteRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { createEmailService } from '../services/email-service';
import {
  CompanyInviteError,
  createCompanyInvite,
  listCompanyInvites,
  resendCompanyInvite,
  revokeCompanyInvite,
} from '../services/company-invite-service';

function userOrThrow(req: Request) {
  if (!req.user) throw new CompanyInviteError('UNAUTHENTICATED', 401);
  return req.user;
}

function companyRoleOrThrow(req: Request) {
  if (!req.companyRole) throw new CompanyInviteError('COMPANY_MEMBER_REQUIRED', 403);
  return req.companyRole;
}

export function handleCompanyInviteError(res: Response, error: unknown) {
  if (error instanceof CompanyInviteError) {
    return res.status(error.status).json({ success: false, code: error.code });
  }
  return res.status(500).json({ success: false, code: 'COMPANY_INVITE_FAILED' });
}

export function createCompanyInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const user = userOrThrow(req);
      const companyRole = companyRoleOrThrow(req);
      const payload = createCompanyInviteRequestSchema.parse(req.body);
      const data = await createCompanyInvite(db, {
        companyId: req.companyId ?? '',
        inviterId: user.id,
        inviterCompanyRole: companyRole,
        email: payload.email,
        role: payload.role,
        nome: payload.nome,
        cognome: payload.cognome,
        expiresInDays: payload.expiresInDays,
      }, createEmailService());
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}

export function listCompanyInvitesHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId ?? '';
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const data = await listCompanyInvites(db, companyId, { page, limit });
      return res.json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}

export function revokeCompanyInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId ?? '';
      await revokeCompanyInvite(db, String(req.params.id), companyId);
      return res.json({ success: true });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}

export function resendCompanyInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId ?? '';
      const data = await resendCompanyInvite(db, String(req.params.id), companyId, createEmailService());
      return res.json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}
