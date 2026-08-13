import { createClient } from '@/lib/supabase/server';
import { getRequestedOperationalContext } from '@/server/services/operational-context-cookie';

const backendUrl = (process.env.BBW_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '');

const forwardedRequestHeaders = new Set(['accept', 'content-type']);

function buildBackendUrl(path: string[], search: string): string {
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  return `${backendUrl}/${encodedPath}${search}`;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function forwardBackendRequest(request: Request, path: string[]): Promise<Response> {
  const headers = new Headers();

  for (const [key, value] of request.headers) {
    if (forwardedRequestHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  const activeOperationalContext = await getRequestedOperationalContext();
  if (activeOperationalContext) {
    headers.set('x-operational-context-kind', activeOperationalContext.kind);
    headers.set('x-operational-context-id', activeOperationalContext.id);
    if (activeOperationalContext.kind === 'organization') {
      headers.set('x-company-id', activeOperationalContext.id);
    }
  }

  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
  const response = await fetch(buildBackendUrl(path, new URL(request.url).search), {
    method,
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual',
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
