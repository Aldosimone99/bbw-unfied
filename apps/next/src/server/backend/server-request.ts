const backendUrl = (process.env.BBW_BACKEND_URL ?? "http://localhost:3001").replace(/\/$/, "");

export type BackendResponse<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: unknown };

export async function requestBackend<T>(path: string, init?: RequestInit): Promise<BackendResponse<T>> {
  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    },
    cache: "no-store"
  });

  const data: unknown = await response.json().catch(() => null);
  return response.ok
    ? { ok: true, status: response.status, data: data as T }
    : { ok: false, status: response.status, data };
}
