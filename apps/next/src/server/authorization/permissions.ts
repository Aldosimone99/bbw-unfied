import { createClient } from "../../lib/supabase/server";
import { AuthorizationError, UnauthenticatedError } from "../../lib/errors/app-error";
import type { MembershipSummary, PermissionCode } from "../../types/authorization";
import { getCurrentUser } from "../auth/current-user";
import { loadAuthorizationContext, type LoadedAuthorizationContext } from "./context";

export function hasPermission(permissions: ReadonlySet<PermissionCode>, permission: PermissionCode): boolean {
  return permissions.has(permission);
}

export function assertPermission(permissions: ReadonlySet<PermissionCode>, permission: PermissionCode): void {
  if (!hasPermission(permissions, permission)) {
    throw new AuthorizationError(permission);
  }
}

export async function getCurrentAuthorizationContext(): Promise<LoadedAuthorizationContext | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  return loadAuthorizationContext(await createClient(), user.id);
}

export async function getUserMemberships(): Promise<MembershipSummary[]> {
  return (await getCurrentAuthorizationContext())?.memberships ?? [];
}

export async function getUserPermissions(): Promise<PermissionCode[]> {
  return (await getCurrentAuthorizationContext())?.permissions ?? [];
}

export async function getActiveOrganization(): Promise<MembershipSummary | null> {
  return (await getCurrentAuthorizationContext())?.activeOrganization ?? null;
}

export const getCurrentOrganization = getActiveOrganization;

export async function can(permission: PermissionCode): Promise<boolean> {
  const context = await getCurrentAuthorizationContext();
  return context ? hasPermission(new Set(context.permissions), permission) : false;
}

export async function requirePermission(permission: PermissionCode): Promise<void> {
  const context = await getCurrentAuthorizationContext();
  if (!context) {
    throw new UnauthenticatedError();
  }

  assertPermission(new Set(context.permissions), permission);
}

export async function canInOrganization(input: {
  organizationId: string;
  permission: PermissionCode;
}): Promise<boolean> {
  const context = await getCurrentAuthorizationContext();
  return Boolean(
    context?.activeOrganization?.organizationId === input.organizationId &&
      hasPermission(new Set(context.permissions), input.permission)
  );
}

export async function requireOrganizationPermission(input: {
  organizationId: string;
  permission: PermissionCode;
}): Promise<void> {
  const context = await getCurrentAuthorizationContext();
  if (!context) {
    throw new UnauthenticatedError();
  }

  if (context.activeOrganization?.organizationId !== input.organizationId) {
    throw new AuthorizationError("organization.context");
  }

  assertPermission(new Set(context.organizationPermissions), input.permission);
}
