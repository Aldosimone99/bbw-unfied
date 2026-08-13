import type { Request, Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import {
  listOrganizationMembers,
  OrganizationMembersError,
  removeOrganizationMember,
} from '../services/organization-members-service';

function organizationIdOrThrow(req: Request): string {
  if (!req.companyId) throw new OrganizationMembersError('OPERATIONAL_CONTEXT_REQUIRED', 422);
  return req.companyId;
}

function userIdOrThrow(req: Request): string {
  if (!req.user) throw new OrganizationMembersError('UNAUTHENTICATED', 401);
  return req.user.id;
}

export function handleOrganizationMembersError(res: Response, error: unknown) {
  if (error instanceof OrganizationMembersError) {
    return res.status(error.status).json({ success: false, code: error.code });
  }
  return res.status(500).json({ success: false, code: 'ORGANIZATION_MEMBER_FAILED' });
}

export function listOrganizationMembersHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const data = await listOrganizationMembers(db, organizationIdOrThrow(req));
      return res.json({ success: true, data });
    } catch (error) {
      return handleOrganizationMembersError(res, error);
    }
  };
}

export function removeOrganizationMemberHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const data = await removeOrganizationMember(
        db,
        organizationIdOrThrow(req),
        String(req.params.membershipId),
        userIdOrThrow(req),
      );
      return res.json({ success: true, data });
    } catch (error) {
      return handleOrganizationMembersError(res, error);
    }
  };
}
