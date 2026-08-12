import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { SupabaseLike } from '../db/supabase';

function companyIdFromRequest(req: Request): string {
  return String(req.companyId ?? '').trim();
}

export function requireCompanyRole(db: SupabaseLike, allowedRoles: string[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, code: 'UNAUTHENTICATED' });

    const companyId = companyIdFromRequest(req);
    if (!companyId) return res.status(422).json({ success: false, code: 'COMPANY_ID_REQUIRED' });

    const { data, error } = await db
      .from('organization_members')
      .select('id,status,member_roles(role:roles(code))')
      .eq('organization_id', companyId)
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) return res.status(403).json({ success: false, code: 'COMPANY_MEMBER_REQUIRED' });

    const roles = ((data as any).member_roles ?? [])
      .map((assignment: any) => assignment.role?.code)
      .filter(Boolean) as string[];
    if (!roles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({ success: false, code: 'COMPANY_ROLE_INSUFFICIENT' });
    }

    req.companyRole = roles.find((role) => allowedRoles.includes(role)) ?? roles[0] ?? null;
    return next();
  };
}
