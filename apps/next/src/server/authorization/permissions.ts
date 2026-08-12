import type { OperationalContext, PermissionCode } from '../../types/authorization';
import { AuthorizationError, UnauthenticatedError } from '../../lib/errors/app-error';
import { getPostLoginContext, type PostLoginContext } from '../services/post-login-service';
import type { LoadedAuthorizationContext } from './context';

export function hasPermission(permissions: ReadonlySet<PermissionCode>, permission: PermissionCode): boolean {
  return permissions.has(permission);
}

export function assertPermission(permissions: ReadonlySet<PermissionCode>, permission: PermissionCode): void {
  if (!hasPermission(permissions, permission)) throw new AuthorizationError(permission);
}

export async function getCurrentAuthorizationContext(): Promise<LoadedAuthorizationContext | null> {
  const context = await getPostLoginContext();
  return context.user ? context : null;
}

export async function getAvailableOperationalContexts(): Promise<OperationalContext[]> {
  return (await getCurrentAuthorizationContext())?.availableOperationalContexts ?? [];
}

export async function getActiveOperationalContext(): Promise<OperationalContext | null> {
  return (await getCurrentAuthorizationContext())?.activeOperationalContext ?? null;
}

export async function requireOperationalContext(): Promise<NonNullable<PostLoginContext['activeOperationalContext']>> {
  const context = await getCurrentAuthorizationContext();
  if (!context) throw new UnauthenticatedError();
  if (!context.activeOperationalContext) throw new AuthorizationError('operational.context');
  return context.activeOperationalContext;
}

export async function requirePersonalProfessionalContext(): Promise<Extract<OperationalContext, { kind: 'personal_professional' }>> {
  const context = await requireOperationalContext();
  if (context.kind !== 'personal_professional') throw new AuthorizationError('operational.context.personal_professional');
  return context;
}

export async function requireOrganizationContext(): Promise<Extract<OperationalContext, { kind: 'organization' }>> {
  const context = await requireOperationalContext();
  if (context.kind !== 'organization') throw new AuthorizationError('operational.context.organization');
  return context;
}

export async function can(permission: PermissionCode): Promise<boolean> {
  const context = await getCurrentAuthorizationContext();
  return context ? hasPermission(new Set(context.permissions), permission) : false;
}

export async function requireOperationalPermission(permission: PermissionCode): Promise<void> {
  const context = await getCurrentAuthorizationContext();
  if (!context) throw new UnauthenticatedError();
  await requireOperationalContext();
  assertPermission(new Set(context.permissions), permission);
}

export const requirePermission = requireOperationalPermission;

export async function requireOrganizationPermission(input: {
  organizationId: string;
  permission: PermissionCode;
}): Promise<void> {
  const context = await getCurrentAuthorizationContext();
  if (!context) throw new UnauthenticatedError();
  const operationalContext = await requireOrganizationContext();
  if (operationalContext.organizationId !== input.organizationId) {
    throw new AuthorizationError('organization.context');
  }
  assertPermission(new Set(context.operationalPermissions), input.permission);
}
