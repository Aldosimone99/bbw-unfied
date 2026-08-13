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
  return (requestedUrl.pathname === '/inviti/accetta' || requestedUrl.pathname === '/inviti/paziente/accetta')
    && requestedUrl.searchParams.has('token')
    && requestedUrl.searchParams.size === 1
    && (requestedUrl.searchParams.get('token')?.length ?? 0) > 0
    && (requestedUrl.searchParams.get('token')?.length ?? 0) <= 512;
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
