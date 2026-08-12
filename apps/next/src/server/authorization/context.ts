import type { OperationalContext, OperationalContextReference, PermissionCode, RoleSummary } from '../../types/authorization';

/**
 * Compatibility shape for server consumers. Data is loaded solely from the
 * backend /auth/context endpoint; this module performs no Supabase reads.
 */
export type LoadedAuthorizationContext = {
  availableOperationalContexts: OperationalContext[];
  activeOperationalContext: OperationalContext | null;
  platformRoles: RoleSummary[];
  operationalRoles: RoleSummary[];
  globalPermissions: PermissionCode[];
  operationalPermissions: PermissionCode[];
  permissions: PermissionCode[];
};

function getContextId(context: OperationalContext): string {
  return context.kind === 'organization' ? context.organizationId : context.professionalProfileId;
}

export function selectActiveOperationalContext(
  contexts: readonly OperationalContext[],
  requestedContext: OperationalContextReference | null = null,
): OperationalContext | null {
  if (requestedContext) {
    return contexts.find((context) => (
      context.kind === requestedContext.kind && getContextId(context) === requestedContext.id
    )) ?? null;
  }

  return contexts.length === 1 ? contexts[0] ?? null : null;
}

export function resolveEffectivePermissions(input: {
  globalPermissions: PermissionCode[];
  operationalPermissions: PermissionCode[];
}): {
  globalPermissions: PermissionCode[];
  operationalPermissions: PermissionCode[];
  permissions: PermissionCode[];
} {
  const globalPermissions = [...new Set(input.globalPermissions)];
  const operationalPermissions = [...new Set(input.operationalPermissions)];
  return {
    globalPermissions,
    operationalPermissions,
    permissions: [...new Set([...globalPermissions, ...operationalPermissions])],
  };
}
