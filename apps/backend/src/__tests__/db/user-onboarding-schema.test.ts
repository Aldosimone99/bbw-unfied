import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceSchema = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260622000000_users_onboarding_identity.sql'),
  'utf8',
);
const baselineSchema = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260619000000_prod_baseline.sql'),
  'utf8',
);
const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260622000000_users_onboarding_identity.sql'),
  'utf8',
);

describe('users onboarding identity schema source', () => {
  it('keeps public.users.id tied directly to auth.users.id', () => {
    expect(baselineSchema).toContain('CREATE TABLE IF NOT EXISTS "public"."users"');
    expect(sourceSchema).toContain('public.users must be created by 20260619000000_prod_baseline.sql');
    expect(sourceSchema).not.toMatch(/CREATE TABLE public\.users/i);
  });
});

describe('users onboarding schema', () => {
  it('creates the user_role enum without privato', () => {
    expect(migration).toContain('20260626000000_transform.sql');
    expect(migration).not.toContain("'privato'");
  });

  it('uses auth.users ids directly for public.users', () => {
    expect(baselineSchema).toContain('"id" "uuid" DEFAULT');
    expect(sourceSchema).not.toContain('REFERENCES auth.users(id)');
  });

  it('does not create legacy identity tables or users.password', () => {
    expect(migration).not.toMatch(/CREATE TABLE public\.profiles/i);
    expect(migration).not.toMatch(/CREATE TABLE public\.user_auth_links/i);
    expect(migration).not.toMatch(/\bpassword\b/i);
  });
});
