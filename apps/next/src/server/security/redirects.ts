export const postLoginRedirectPaths = [
  '/login',
  '/onboarding',
  '/dashboard',
  '/seleziona-contesto',
  '/admin',
] as const;

export type PostLoginRedirectPath = (typeof postLoginRedirectPaths)[number];

const redirectOrigin = 'https://bbw.local';
const allowedRedirectPaths = new Set<string>(postLoginRedirectPaths);

function isSafeInvitationAcceptanceRedirect(requestedUrl: URL): boolean {
  if (requestedUrl.pathname !== '/inviti/accetta') return false;
  const token = requestedUrl.searchParams.get('token');
  return typeof token === 'string'
    && token.length > 0
    && requestedUrl.searchParams.size === 1
    && token.length <= 512;
}

export function resolveSafePostLoginRedirect(
  requestedRedirect: string | undefined,
  canonicalDestination: PostLoginRedirectPath,
): string {
  if (!requestedRedirect || !requestedRedirect.startsWith('/') || requestedRedirect.startsWith('//')) {
    return canonicalDestination;
  }

  if (requestedRedirect.includes('\\')) {
    return canonicalDestination;
  }

  try {
    const requestedUrl = new URL(requestedRedirect, redirectOrigin);
    if (requestedUrl.origin !== redirectOrigin) return canonicalDestination;

    if (isSafeInvitationAcceptanceRedirect(requestedUrl)) {
      return `${requestedUrl.pathname}${requestedUrl.search}`;
    }

    if (!allowedRedirectPaths.has(requestedUrl.pathname) || requestedUrl.pathname !== canonicalDestination) {
      return canonicalDestination;
    }

    return `${requestedUrl.pathname}${requestedUrl.search}`;
  } catch {
    return canonicalDestination;
  }
}
