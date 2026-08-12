import type { OperationalContextReference, OperationalReadiness } from '@bbw/interfaces';

import { getTransitionAuthorizationContext } from '../auth/transition-session';
import type { OperationalContextSummary, PermissionCode, ProfileSummary } from '../../types/authorization';
import { resolveSafePostLoginRedirect, type PostLoginRedirectPath } from '../security/redirects';
import {
  getRequestedOperationalContext,
  setOperationalContextCookie,
} from './operational-context-cookie';

export type PostLoginDestination = PostLoginRedirectPath;

export type PostLoginContext = OperationalContextSummary & {
  user: { id: string; email: string | null } | null;
  profile: ProfileSummary | null;
  globalPermissions: PermissionCode[];
  operationalPermissions: PermissionCode[];
  permissions: PermissionCode[];
  readiness: OperationalReadiness | null;
};

function emptyPostLoginContext(): PostLoginContext {
  return {
    user: null,
    profile: null,
    availableOperationalContexts: [],
    activeOperationalContext: null,
    platformRoles: [],
    operationalRoles: [],
    globalPermissions: [],
    operationalPermissions: [],
    permissions: [],
    readiness: null,
  };
}

export async function getPostLoginContext(
  requestedContext?: OperationalContextReference | null,
): Promise<PostLoginContext> {
  const requestedOperationalContext = requestedContext === undefined
    ? await getRequestedOperationalContext()
    : requestedContext;
  const authorizationContext = await getTransitionAuthorizationContext(requestedOperationalContext);
  if (!authorizationContext) return emptyPostLoginContext();

  return {
    user: { id: authorizationContext.user.id, email: authorizationContext.user.email ?? null },
    profile: authorizationContext.profile,
    availableOperationalContexts: authorizationContext.availableOperationalContexts,
    activeOperationalContext: authorizationContext.activeOperationalContext,
    platformRoles: authorizationContext.platformRoles,
    operationalRoles: authorizationContext.operationalRoles,
    globalPermissions: authorizationContext.globalPermissions,
    operationalPermissions: authorizationContext.operationalPermissions,
    permissions: authorizationContext.permissions,
    readiness: authorizationContext.readiness,
  };
}

export function getOperationalContextReference(context: NonNullable<PostLoginContext['activeOperationalContext']>): OperationalContextReference {
  return context.kind === 'organization'
    ? { kind: context.kind, id: context.organizationId }
    : { kind: context.kind, id: context.professionalProfileId };
}

export function resolveDestinationFromContext(context: PostLoginContext): PostLoginDestination {
  if (!context.user) return '/login';
  if (context.profile?.onboardingStatus !== 'completed') return '/onboarding';
  if (context.activeOperationalContext || context.availableOperationalContexts.length <= 1) return '/dashboard';
  return '/seleziona-contesto';
}

export async function resolvePostLoginDestination(requestedRedirect?: string): Promise<string> {
  const context = await getPostLoginContext();
  const destination = resolveDestinationFromContext(context);

  if (
    context.user
    && context.profile?.onboardingStatus === 'completed'
    && context.availableOperationalContexts.length === 1
    && context.activeOperationalContext
  ) {
    await setOperationalContextCookie(getOperationalContextReference(context.activeOperationalContext));
  }

  return resolveSafePostLoginRedirect(requestedRedirect, destination);
}
