import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813000300_catalog_master_and_offerings.sql'),
  'utf8',
);
const alignmentMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814000000_domain_alignment.sql'),
  'utf8',
);

describe('canonical catalog schema', () => {
  it('separates the master catalog from organization and personal offerings', () => {
    expect(migration).toContain('create table public.treatment_categories');
    expect(migration).toContain('create table public.catalog_treatments');
    expect(migration).toContain('create table public.organization_treatment_offerings');
    expect(migration).toContain('create table public.professional_treatment_offerings');
    expect(migration).toContain('default_price_cents integer');
    expect(migration).toContain('price_cents integer');
    expect(migration).not.toContain('platform_treatments');
  });

  it('keeps offering mutations scoped, soft-deleted and audited', () => {
    expect(migration).toContain('create or replace function public.import_catalog_master');
    expect(migration).toContain('on conflict (external_code) do update');
    expect(migration).toContain('set is_active = false');
    expect(migration).toContain('create or replace function public.create_organization_treatment_offering');
    expect(migration).toContain('create or replace function public.create_professional_treatment_offering');
    expect(migration).toContain('create or replace function public.update_organization_treatment_offering');
    expect(migration).toContain('create or replace function public.update_professional_treatment_offering');
    expect(migration).toContain('create or replace function public.remove_organization_treatment_offering');
    expect(migration).toContain('create or replace function public.remove_professional_treatment_offering');
    expect(migration).toContain("'catalog.offering.created'");
    expect(migration).toContain("'catalog.offering.updated'");
    expect(migration).toContain("'catalog.offering.removed'");
    expect(migration).not.toMatch(/resource_id,\s*resource_id/);
  });

  it('enables RLS and avoids permissive policies', () => {
    expect(migration).toContain('alter table public.treatment_categories enable row level security');
    expect(migration).toContain('alter table public.catalog_treatments enable row level security');
    expect(migration).toContain('alter table public.organization_treatment_offerings enable row level security');
    expect(migration).toContain('alter table public.professional_treatment_offerings enable row level security');
    expect(migration).toContain('create policy organization_treatment_offerings_select');
    expect(migration).toContain('create policy professional_treatment_offerings_select');
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });
});

describe('domain-aligned catalog schema', () => {
  it('separates BBW templates from organization and professional custom definitions', () => {
    expect(alignmentMigration).toContain("source in ('bbw_template', 'organization', 'professional')");
    expect(alignmentMigration).toContain('owner_organization_id');
    expect(alignmentMigration).toContain('owner_professional_profile_id');
    expect(alignmentMigration).toContain('create_organization_custom_treatment');
    expect(alignmentMigration).toContain('create_professional_custom_treatment');
    expect(alignmentMigration).toContain('list_accessible_treatment_definitions');
  });

  it('keeps CSV import ownership limited to BBW templates', () => {
    expect(alignmentMigration).toContain("source, is_active");
    expect(alignmentMigration).toContain("'bbw_template', true");
    expect(alignmentMigration).toContain("source = 'bbw_template' and not (external_code = any(incoming_codes))");
  });

  it('adds relationship origin, logical patient deletion and immutable audit events', () => {
    expect(alignmentMigration).toContain('origin_kind');
    expect(alignmentMigration).toContain('soft_delete_patient_subject');
    expect(alignmentMigration).toContain('create trigger audit_events_immutable');
    expect(alignmentMigration).toContain('revoke update, delete on public.audit_events');
    expect(alignmentMigration).not.toContain('delete from public.audit_events');
  });
});
