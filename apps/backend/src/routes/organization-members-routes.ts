import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import { requireCompanyPermission } from '../middleware/require-company-permission-middleware';
import {
  listOrganizationMembersHandler,
  removeOrganizationMemberHandler,
} from '../controllers/organization-members-controller';

type OrganizationMembersRouterOptions = {
  resolveUserMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
};

export function createOrganizationMembersRouter(
  db: SupabaseLike,
  options: OrganizationMembersRouterOptions = {},
): Router {
  const router = Router();
  const requireUser = options.resolveUserMiddleware ?? resolveUser(db);

  router.get('/', requireUser, requireCompanyPermission(db, 'organization.members.read'), listOrganizationMembersHandler(db));
  router.delete('/:membershipId', requireUser, requireCompanyPermission(db, 'organization.members.manage'), removeOrganizationMemberHandler(db));
  return router;
}
