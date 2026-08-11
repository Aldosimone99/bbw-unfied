import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260628_catalog.sql'),
  'utf8',
);
const seed = readFileSync(
  resolve(__dirname, '../../../supabase/seeds/03_platform_treatments.sql'),
  'utf8',
);

describe('catalog schema', () => {
  it('creates all catalog tables', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.platform_treatments');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.company_treatment_catalog');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.professional_catalog_assignments');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.custom_services');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.professional_catalog_items');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.company_service_catalog');
  });

  it('defines public flags, source constraint, and effective view', () => {
    expect(migration).toContain('is_public BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('CONSTRAINT pca_exactly_one_source');
    expect(migration).toContain('CREATE OR REPLACE VIEW public.professional_catalog_effective');
    expect(migration).toContain('COALESCE(pca.price_override_cents');
  });

  it('does not create removed or out-of-scope tables', () => {
    expect(migration).not.toContain('professional_offered_treatments');
    expect(migration).not.toContain('company_service_requests');
  });

  it('seeds platform treatments idempotently', () => {
    expect(seed).toContain('INSERT INTO public.platform_treatments');
    expect(seed).toContain('ON CONFLICT (slug) DO NOTHING');
    expect(seed).toContain('viso');
    expect(seed).toContain('botox');
  });
});
