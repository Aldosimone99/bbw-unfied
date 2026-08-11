import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260625_registration_contracts_documents.sql'),
  'utf8',
);
const fixture = readFileSync(
  resolve(__dirname, '../../db/registration-contracts-documents.sql'),
  'utf8',
);

describe('registration contracts and documents schema', () => {
  it('creates append-only contract signature evidence', () => {
    expect(migration).toContain('CREATE TABLE public.contract_signatures');
    expect(migration).toContain('contract_type TEXT NOT NULL');
    expect(migration).toContain('signature_hash TEXT NOT NULL');
    expect(migration).toContain('signed_at TIMESTAMPTZ NOT NULL DEFAULT now()');
  });

  it('creates professional verification and document tables', () => {
    expect(migration).toContain('CREATE TABLE public.professional_verifications');
    expect(migration).toContain('CREATE TABLE public.verification_documents');
    expect(migration).toContain('UNIQUE (user_id, professional_type)');
  });

  it('creates deferred upload recovery table', () => {
    expect(migration).toContain('CREATE TABLE public.deferred_document_uploads');
    expect(migration).toContain('status TEXT NOT NULL DEFAULT');
  });

  it('keeps fixture aligned with runtime migration', () => {
    expect(fixture).toContain('CREATE TABLE public.contract_signatures');
    expect(fixture).toContain('CREATE TABLE public.deferred_document_uploads');
  });
});
