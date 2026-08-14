import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813000200_patient_relationships.sql'),
  'utf8',
);
const alignmentMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814000000_domain_alignment.sql'),
  'utf8',
);

describe('patient relationships schema', () => {
  it('uses subjects as the single global patient identity', () => {
    expect(migration).toContain("insert into public.subjects (subject_kind, user_id)");
    expect(migration).toContain('create table public.organization_patient_relationships');
    expect(migration).toContain('create table public.professional_patient_relationships');
    expect(migration).toContain('organization_patient_relationship_unique unique (organization_id, subject_id)');
    expect(migration).toContain('professional_patient_relationship_unique unique (professional_profile_id, subject_id)');
    expect(migration).not.toMatch(/create table public\.patients/i);
  });

  it('keeps relationship mutations transactional and audited', () => {
    expect(migration).toContain('create or replace function public.link_organization_patient');
    expect(migration).toContain('create or replace function public.link_professional_patient');
    expect(migration).toContain('create or replace function public.remove_organization_patient_relationship');
    expect(migration).toContain('create or replace function public.remove_professional_patient_relationship');
    expect(migration).toContain("'patient.relationship.created'");
    expect(migration).toContain("'patient.relationship.removed'");
  });

  it('does not use permissive RLS and scopes both relationship tables', () => {
    expect(migration).toContain('alter table public.organization_patient_relationships enable row level security');
    expect(migration).toContain('alter table public.professional_patient_relationships enable row level security');
    expect(migration).toContain('create policy organization_patient_relationships_select');
    expect(migration).toContain('create policy professional_patient_relationships_select');
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });
});


describe('domain-aligned patient lifecycle schema', () => {
  it('records relationship origin separately from the global subject identity', () => {
    expect(alignmentMigration).toContain('organization_patient_relationship_origin_check');
    expect(alignmentMigration).toContain('professional_patient_relationship_origin_check');
    expect(alignmentMigration).toContain("origin_kind = 'organization'");
    expect(alignmentMigration).toContain("origin_kind = 'professional'");
  });

  it('uses logical deletion for patient subjects and filters default reads', () => {
    expect(alignmentMigration).toContain('deleted_at timestamptz');
    expect(alignmentMigration).toContain('subject.deleted_at is null');
    expect(alignmentMigration).toContain('create or replace function public.soft_delete_patient_subject');
    expect(alignmentMigration).toContain('reject_deleted_patient_relationship');
  });
});
