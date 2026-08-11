export async function backendRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.replace(/^\//, "");
  const response = await fetch(`/api/backend/${normalizedPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Backend request failed with status ${response.status}`);
    Object.assign(error, { status: response.status, payload });
    throw error;
  }

  return payload as T;
}
