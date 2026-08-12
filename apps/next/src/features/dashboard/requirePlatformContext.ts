import { forbidden, redirect } from 'next/navigation';

import { hasPermission } from '../../server/authorization/permissions';
import { getPostLoginContext, type PostLoginContext } from '../../server/services/post-login-service';

export type AuthorizedPlatformContext = PostLoginContext & {
  user: NonNullable<PostLoginContext['user']>;
  profile: NonNullable<PostLoginContext['profile']>;
};

export async function requireActiveOperationalContext() {
  const context = await getPostLoginContext();
  if (!context.user) redirect('/login');
  if (!context.activeOperationalContext) {
    if (context.availableOperationalContexts.length > 1) redirect('/seleziona-contesto');
    forbidden();
  }
  return context.activeOperationalContext;
}

export async function requirePlatformContext(requireOperationalContext = false): Promise<AuthorizedPlatformContext> {
  const context = await getPostLoginContext();
  if (!context.user) redirect('/login');
  if (context.profile?.onboardingStatus !== 'completed') redirect('/onboarding');
  if (!hasPermission(new Set(context.permissions), 'dashboard.access')) forbidden();
  if (requireOperationalContext && !context.activeOperationalContext) {
    if (context.availableOperationalContexts.length > 1) redirect('/seleziona-contesto');
    forbidden();
  }
  if (!context.profile) redirect('/login');
  return context as AuthorizedPlatformContext;
}
