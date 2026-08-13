import { createHash, randomBytes } from 'node:crypto';

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function buildInvitationLink(path: string, token: string): string {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}?${new URLSearchParams({ token }).toString()}`;
}
