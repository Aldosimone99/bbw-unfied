import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813000300_catalog_master_and_offerings.sql'),
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
