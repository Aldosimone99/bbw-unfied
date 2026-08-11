import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260624_invites_referrals.sql'),
  'utf8',
);
const fixture = readFileSync(
  resolve(__dirname, '../../db/invites-referrals.sql'),
  'utf8',
);

describe('invites and referrals schema', () => {
  it('adds owner_id column to invites table', () => {
    expect(migration).toContain('ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS owner_id');
    expect(migration).toContain('UUID REFERENCES public.users(id)');
  });

  it('creates invites indexes if not exist', () => {
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_invites_owner');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_invites_code');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_invites_email');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_invites_status');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_invites_company');
  });

  it('keeps fixture aligned with runtime migration', () => {
    expect(fixture).toContain('ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS owner_id');
    expect(fixture).toContain('CREATE INDEX IF NOT EXISTS idx_invites_owner');
  });

  it('defines company member invite tables and indexes', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.company_members');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.company_member_invites');
    expect(migration).toContain('idx_company_member_invites_company');
    expect(migration).toContain('idx_company_member_invites_email_pending');
    expect(migration).toContain('idx_company_members_company_user_active');
  });

  it('supports the clinic role set required by company invites', () => {
    expect(migration).toContain("'profissional'");
    expect(migration).toContain("'paciente'");
    expect(migration).toContain("'medico'");
    expect(migration).toContain("'estetista'");
    expect(migration).toContain("'cliente'");
  });

  it('keeps company invite fixture aligned with runtime migration', () => {
    expect(fixture).toContain('CREATE TABLE IF NOT EXISTS public.company_members');
    expect(fixture).toContain('CREATE TABLE IF NOT EXISTS public.company_member_invites');
    expect(fixture).toContain('idx_company_member_invites_email_pending');
  });
});
