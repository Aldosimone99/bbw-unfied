import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import {
  acceptCompanyInvite,
  CompanyInviteError,
  lookupCompanyInvite,
} from '../services/company-invite-service';
import { resolveUser } from '../middleware/resolve-user-middleware';
import { requireCompanyRole } from '../middleware/require-company-role-middleware';
import {
  createCompanyInviteHandler,
  handleCompanyInviteError,
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
  const requireInviteRole = requireCompanyRole(db, ['organization_owner', 'organization_admin', 'office_manager']);

  router.get('/lookup/:token', createCompanyInviteLookupHandler(db));
  router.post('/accept', requireUser, createCompanyInviteAcceptHandler(db));
  router.post('/', requireUser, requireInviteRole, createCompanyInviteHandler(db));
  router.get('/', requireUser, requireInviteRole, listCompanyInvitesHandler(db));
  router.delete('/:id', requireUser, requireInviteRole, revokeCompanyInviteHandler(db));
  router.post('/:id/resend', requireUser, requireInviteRole, resendCompanyInviteHandler(db));
  return router;
}

function handleCompanyInviteErrorLocal(res: Response, error: unknown) {
  if (error instanceof CompanyInviteError) return res.status(error.status).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'COMPANY_INVITE_FAILED' });
}

export function createCompanyInviteLookupHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const data = await lookupCompanyInvite(db, String(req.params.token || ''));
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
