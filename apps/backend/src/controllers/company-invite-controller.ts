import type { Request, Response } from 'express';
import { createCompanyInviteRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import {
  CompanyInviteError,
  createCompanyInvite,
  listAssignableOrganizationInvitationRoles,
  listCompanyInvites,
  resendCompanyInvite,
  revokeCompanyInvite,
} from '../services/company-invite-service';

function userOrThrow(req: Request) {
  if (!req.user) throw new CompanyInviteError('UNAUTHENTICATED', 401);
  return req.user;
}

function organizationIdOrThrow(req: Request): string {
  if (!req.companyId) throw new CompanyInviteError('OPERATIONAL_CONTEXT_REQUIRED', 422);
  return req.companyId;
}

export function handleCompanyInviteError(res: Response, error: unknown) {
  if (error instanceof CompanyInviteError) {
    return res.status(error.status).json({ success: false, code: error.code });
  }
  return res.status(500).json({ success: false, code: 'INVITATION_FAILED' });
}

export function createCompanyInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const user = userOrThrow(req);
      const payload = createCompanyInviteRequestSchema.parse(req.body);
      const data = await createCompanyInvite(db, {
        organizationId: organizationIdOrThrow(req),
        inviterId: user.id,
        email: payload.email,
        roleId: payload.roleId,
        expiresInDays: payload.expiresInDays,
      });
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}

export function listAssignableCompanyInviteRolesHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const user = userOrThrow(req);
      const data = await listAssignableOrganizationInvitationRoles(db, organizationIdOrThrow(req), user.id);
      return res.json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}

export function listCompanyInvitesHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const data = await listCompanyInvites(db, organizationIdOrThrow(req), { page, limit });
      return res.json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}

export function revokeCompanyInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const user = userOrThrow(req);
      await revokeCompanyInvite(db, String(req.params.id), organizationIdOrThrow(req), user.id);
      return res.json({ success: true });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}

export function resendCompanyInviteHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const user = userOrThrow(req);
      const data = await resendCompanyInvite(db, String(req.params.id), organizationIdOrThrow(req), user.id);
      return res.json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteError(res, error);
    }
  };
}
