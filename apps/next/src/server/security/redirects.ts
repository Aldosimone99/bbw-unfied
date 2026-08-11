export const postLoginRedirectPaths = [
  "/login",
  "/onboarding",
  "/dashboard",
  "/select-context",
  "/admin"
] as const;

export type PostLoginRedirectPath = (typeof postLoginRedirectPaths)[number];

const redirectOrigin = "https://bbw.local";
const allowedRedirectPaths = new Set<string>(postLoginRedirectPaths);

export function resolveSafePostLoginRedirect(
  requestedRedirect: string | undefined,
  canonicalDestination: PostLoginRedirectPath
): string {
  if (!requestedRedirect || !requestedRedirect.startsWith("/") || requestedRedirect.startsWith("//")) {
    return canonicalDestination;
  }

  if (requestedRedirect.includes("\\")) {
    return canonicalDestination;
  }

  try {
    const requestedUrl = new URL(requestedRedirect, redirectOrigin);
    if (requestedUrl.origin !== redirectOrigin || !allowedRedirectPaths.has(requestedUrl.pathname)) {
      return canonicalDestination;
    }

    if (requestedUrl.pathname !== canonicalDestination) {
      return canonicalDestination;
    }

    return `${requestedUrl.pathname}${requestedUrl.search}`;
  } catch {
    return canonicalDestination;
  }
}
