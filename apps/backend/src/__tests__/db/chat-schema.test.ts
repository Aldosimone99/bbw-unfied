import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260626_chat.sql'),
  'utf8',
);

describe('chat schema', () => {
  it('creates patient professional links', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.patient_professional_links');
    expect(migration).toContain('professional_id UUID NOT NULL REFERENCES public.users(id)');
    expect(migration).toContain('patient_id UUID NOT NULL REFERENCES public.users(id)');
    expect(migration).toContain("status TEXT NOT NULL DEFAULT 'pending'");
    expect(migration).toContain('idx_ppl_approved');
    expect(migration).toContain('idx_ppl_approved_patient');
  });

  it('adds canonical chat pair columns and unique index', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS user_a_id UUID REFERENCES public.users(id)');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS user_b_id UUID REFERENCES public.users(id)');
    expect(migration).toContain('idx_threads_1on1_pair');
    expect(migration).toContain("WHERE thread_type = 'chat'");
  });

  it('defines chat contacts RPC', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.get_chat_contacts');
    expect(migration).toContain('RETURNS TABLE');
  });

  it('defines chat authorization function and RLS', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_allowed_to_chat');
    expect(migration).toContain('patient_professional_links');
    expect(migration).toContain('company_members a');
    expect(migration).toContain('ppl_professional');
    expect(migration).toContain('ppl_patient');
  });
});
