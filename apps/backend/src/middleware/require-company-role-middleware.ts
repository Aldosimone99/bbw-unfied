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
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return res.status(403).json({ success: false, code: 'COMPANY_MEMBER_REQUIRED' });

    const role = String((data as { role: string }).role);
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, code: 'COMPANY_ROLE_INSUFFICIENT' });
    }

    req.companyRole = role;
    return next();
  };
}
