import { z } from 'zod';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { SupabaseLike } from '../db/supabase';

const organizationIdSchema = z.string().uuid();

type MembershipRecord = { id: string };
type RoleAssignmentRecord = { role_id: string };
type RolePermissionRecord = { permission_id: string };
type PermissionRecord = { code: string };

export function requireCompanyPermission(db: SupabaseLike, requiredPermission: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, code: 'UNAUTHENTICATED' });

    const parsedOrganizationId = organizationIdSchema.safeParse(req.companyId);
    if (!parsedOrganizationId.success) {
      return res.status(422).json({ success: false, code: 'OPERATIONAL_CONTEXT_REQUIRED' });
    }

    const organizationId = parsedOrganizationId.data;
    const { data: organizationData, error: organizationError } = await db
      .from('organizations')
      .select('status')
      .eq('id', organizationId)
      .maybeSingle();
    const organization = organizationData as unknown as { status?: string } | null;
    if (organizationError || organization?.status !== 'active') {
      return res.status(403).json({ success: false, code: 'FORBIDDEN' });
    }

    const { data: membershipData, error: membershipError } = await db
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();
    const membership = membershipData as unknown as MembershipRecord | null;
    if (membershipError || !membership) return res.status(403).json({ success: false, code: 'FORBIDDEN' });

    const { data: roleAssignmentsData, error: roleAssignmentsError } = await db
      .from('member_roles')
      .select('role_id')
      .eq('organization_member_id', membership.id);
    if (roleAssignmentsError) return res.status(500).json({ success: false, code: 'AUTHORIZATION_CONTEXT_FAILED' });
    const roleIds = (roleAssignmentsData ?? [])
      .map((assignment: unknown) => (assignment as RoleAssignmentRecord).role_id)
      .filter(Boolean);
    if (roleIds.length === 0) return res.status(403).json({ success: false, code: 'FORBIDDEN' });

    const { data: rolePermissionsData, error: rolePermissionsError } = await db
      .from('role_permissions')
      .select('permission_id')
      .in('role_id', roleIds);
    if (rolePermissionsError) return res.status(500).json({ success: false, code: 'AUTHORIZATION_CONTEXT_FAILED' });
    const permissionIds = (rolePermissionsData ?? [])
      .map((assignment: unknown) => (assignment as RolePermissionRecord).permission_id)
      .filter(Boolean);
    if (permissionIds.length === 0) return res.status(403).json({ success: false, code: 'FORBIDDEN' });

    const { data: permissionsData, error: permissionsError } = await db
      .from('permissions')
      .select('code')
      .in('id', permissionIds);
    if (permissionsError) return res.status(500).json({ success: false, code: 'AUTHORIZATION_CONTEXT_FAILED' });
    const permissionCodes = (permissionsData ?? [])
      .map((permission: unknown) => (permission as PermissionRecord).code);
    if (!permissionCodes.includes(requiredPermission)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN' });
    }

    return next();
  };
}
