import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceSchema = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260622_users_onboarding_identity.sql'),
  'utf8',
);
const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260622_users_onboarding_identity.sql'),
  'utf8',
);

describe('users onboarding identity schema source', () => {
  it('keeps public.users.id tied directly to auth.users.id', () => {
    expect(sourceSchema).toContain('id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE');
    expect(sourceSchema).not.toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(migration).toContain('id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE');
  });
});

describe('users onboarding schema', () => {
  it('creates the user_role enum without privato', () => {
    const enumBody = migration.match(/CREATE TYPE public\.user_role AS ENUM \(([\s\S]*?)\);/)?.[1] ?? '';

    expect(enumBody).toContain("'admin'");
    expect(enumBody).toContain("'cliente'");
    expect(enumBody).not.toContain("'privato'");
  });

  it('uses auth.users ids directly for public.users', () => {
    expect(migration).toContain('id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE');
  });

  it('does not create legacy identity tables or users.password', () => {
    expect(migration).not.toMatch(/CREATE TABLE public\.profiles/i);
    expect(migration).not.toMatch(/CREATE TABLE public\.user_auth_links/i);
    expect(migration).not.toMatch(/\bpassword\b/i);
  });
});
