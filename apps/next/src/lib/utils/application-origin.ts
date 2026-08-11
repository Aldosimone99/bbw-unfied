const localOrigins = new Set(["http://127.0.0.1:3000", "http://localhost:3000"]);

function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function resolveApplicationOrigin(configuredSiteUrl: string | undefined, requestOrigin: string | null): string | null {
  if (configuredSiteUrl?.trim()) {
    return parseOrigin(configuredSiteUrl.trim());
  }

  return requestOrigin && localOrigins.has(requestOrigin) ? requestOrigin : null;
}
