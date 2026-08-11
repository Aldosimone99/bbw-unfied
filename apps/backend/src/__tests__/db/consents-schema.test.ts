import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260701_consents.sql'), 'utf8');

describe('consents schema migration', () => {
  it('creates all consent tables', () => {
    expect(sql).toContain('CREATE TABLE public.consent_templates');
    expect(sql).toContain('CREATE TABLE public.consent_documents');
    expect(sql).toContain('CREATE TABLE public.consent_document_versions');
    expect(sql).toContain('CREATE TABLE public.consent_signatures');
    expect(sql).toContain('CREATE TABLE public.consent_audit_logs');
    expect(sql).toContain('CREATE TABLE public.consent_share_tokens');
    expect(sql).toContain('CREATE TABLE public.secure_otps');
  });

  it('enforces source, signature method, and FSM status checks', () => {
    expect(sql).toContain("CHECK (source IN ('editor', 'uploaded'))");
    expect(sql).not.toContain('ai_generated');
    expect(sql).toContain("CHECK (method IN ('GRAPHOMETRIC', 'OTP_EMAIL'))");
    expect(sql).toContain("'awaiting_doctor_signature'");
    expect(sql).toContain("'awaiting_clinic_signature'");
    expect(sql).toContain("'fully_signed'");
  });

  it('adds clinic signature and company columns', () => {
    expect(sql).toContain('requires_clinic_signature BOOLEAN NOT NULL DEFAULT true');
    expect(sql).toMatch(/company_id\s+UUID REFERENCES public\.companies\(id\)/);
    expect(sql).toContain('UNIQUE (treatment_id)');
  });

  it('enables RLS and participant policies', () => {
    expect(sql).toContain('ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY "templates_owner"');
    expect(sql).toContain('ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY "docs_participant"');
    expect(sql).toContain('CREATE POLICY "audit_participant_read"');
  });
});
