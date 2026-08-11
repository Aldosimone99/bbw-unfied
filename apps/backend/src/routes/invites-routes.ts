import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  createInviteHandler,
  listInvitesHandler,
  resendInviteHandler,
  revokeInviteHandler,
  handleInviteError,
} from '../controllers/invite-controller';
import { InviteError, lookupInviteByToken, validateInviteCode } from '../services/invite-service';

type InvitesRouterOptions = {
  resolveUserMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
};

export function createInvitesRouter(db: SupabaseLike, options: InvitesRouterOptions = {}): Router {
  const router = Router();
  const requireUser = options.resolveUserMiddleware ?? resolveUser(db);

  router.post('/', requireUser, createInviteHandler(db));
  router.get('/', requireUser, listInvitesHandler(db));
  router.delete('/:id', requireUser, revokeInviteHandler(db));
  router.post('/:id/resend', requireUser, resendInviteHandler(db));

  router.get('/accept/:token', createInviteTokenLookupHandler(db));
  router.get('/validate/:code', createInviteCodeValidateHandler(db));
  return router;
}

export function createInviteTokenLookupHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const data = await lookupInviteByToken(db, String(req.params.token || ''));
      return res.json({ success: true, data });
    } catch (error) {
      return handleInviteError(res, error);
    }
  };
}

export function createInviteCodeValidateHandler(db: SupabaseLike) {
  return async (req: Request, res: Response) => {
    try {
      const invite = await validateInviteCode(db, String(req.params.code || ''));
      return res.json({ success: true, data: { valid: true, code: invite.code, email: invite.email, role: invite.type } });
    } catch (error) {
      return handleInviteError(res, error);
    }
  };
}
