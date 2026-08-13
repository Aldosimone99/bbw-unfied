import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import {
  acceptCompanyInvite,
  CompanyInviteError,
  lookupCompanyInvite,
} from '../services/company-invite-service';
import { resolveUser } from '../middleware/resolve-user-middleware';
import { requireCompanyPermission } from '../middleware/require-company-permission-middleware';
import {
  createCompanyInviteHandler,
  handleCompanyInviteError,
  listAssignableCompanyInviteRolesHandler,
  listCompanyInvitesHandler,
  resendCompanyInviteHandler,
  revokeCompanyInviteHandler,
} from '../controllers/company-invite-controller';

type CompanyInvitesRouterOptions = {
  resolveUserMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
};

export function createCompanyInvitesRouter(db: SupabaseLike, options: CompanyInvitesRouterOptions = {}): Router {
  const router = Router();
  const requireUser = options.resolveUserMiddleware ?? resolveUser(db);
  const requireInvitationPermission = requireCompanyPermission(db, 'organization.members.invite');

  router.post('/lookup', createCompanyInviteLookupHandler(db));
  router.post('/accept', requireUser, createCompanyInviteAcceptHandler(db));
  router.get('/assignable-roles', requireUser, requireInvitationPermission, listAssignableCompanyInviteRolesHandler(db));
  router.post('/', requireUser, requireInvitationPermission, createCompanyInviteHandler(db));
  router.get('/', requireUser, requireInvitationPermission, listCompanyInvitesHandler(db));
  router.delete('/:id', requireUser, requireInvitationPermission, revokeCompanyInviteHandler(db));
  router.post('/:id/resend', requireUser, requireInvitationPermission, resendCompanyInviteHandler(db));
  return router;
}

function handleCompanyInviteErrorLocal(res: Response, error: unknown) {
  if (error instanceof CompanyInviteError) return res.status(error.status).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'INVITATION_FAILED' });
}

export function createCompanyInviteLookupHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const data = await lookupCompanyInvite(db, String(req.body?.token || '').trim());
      return res.json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteErrorLocal(res, error);
    }
  };
}

export function createCompanyInviteAcceptHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const token = String(req.body?.token || '').trim();
      const userId = String(req.user?.id || '').trim();
      if (!token || !userId) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await acceptCompanyInvite(db, token, userId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleCompanyInviteErrorLocal(res, error);
    }
  };
}
