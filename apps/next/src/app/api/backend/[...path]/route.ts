import { forwardBackendRequest } from "@/server/backend/backend-proxy";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handler(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return forwardBackendRequest(request, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
