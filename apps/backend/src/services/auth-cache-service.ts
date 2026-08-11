import { createHash } from 'node:crypto';
import type { ResolvedUser } from './types';

interface CacheEntry {
  user: ResolvedUser;
  expiresAt: number;
}

export class AuthCache {
  private entries = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs = 60_000) {}

  get(token: string, now = Date.now()): ResolvedUser | null {
    const entry = this.entries.get(this.key(token));
    if (!entry || entry.expiresAt <= now) return null;
    return entry.user;
  }

  set(token: string, user: ResolvedUser, now = Date.now()): void {
    this.entries.set(this.key(token), { user, expiresAt: now + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }

  private key(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export const authCache = new AuthCache();
