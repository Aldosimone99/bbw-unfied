import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260630000000_availability.sql');
const sql = readFileSync(migrationPath, 'utf8');

describe('availability schema migration', () => {
  it('adds profile_slug to users with a partial index', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS profile_slug TEXT UNIQUE');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_users_profile_slug ON public.users (profile_slug)');
    expect(sql).toContain('WHERE profile_slug IS NOT NULL');
  });

  it('enables row level security for availability tables', () => {
    expect(sql).toContain('ALTER TABLE public.booking_availability ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.booking_blocked_slots ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.company_rooms ENABLE ROW LEVEL SECURITY');
  });

  it('creates ownership and clinic room policies', () => {
    expect(sql).toContain('CREATE POLICY "avail_own"');
    expect(sql).toContain('CREATE POLICY "avail_clinic_read"');
    expect(sql).toContain('CREATE POLICY "blocked_own"');
    expect(sql).toContain('CREATE POLICY "settings_own"');
    expect(sql).toContain('CREATE POLICY "rooms_clinic"');
    expect(sql).toContain("role IN ('owner', 'admin', 'staff')");
  });
});
