import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260629_bookings.sql');
const sql = readFileSync(migrationPath, 'utf8');

describe('bookings schema migration', () => {
  it('creates PPL, invite, booking, and auxiliary tables', () => {
    expect(sql).toContain('CREATE TABLE public.patient_professional_links');
    expect(sql).toContain('CREATE TABLE public.ppl_invites');
    expect(sql).toContain('CREATE TABLE public.bookings');
    expect(sql).toContain('CREATE TABLE public.booking_availability');
    expect(sql).toContain('CREATE TABLE public.booking_blocked_slots');
    expect(sql).toContain('CREATE TABLE public.booking_settings');
    expect(sql).toContain('CREATE TABLE public.booking_notification_deliveries');
    expect(sql).toContain('CREATE TABLE public.company_rooms');
    expect(sql).toContain('CREATE TABLE public.treatments');
    expect(sql).toContain('CREATE TABLE public.binding_requests');
  });

  it('enforces lifecycle statuses and uniqueness', () => {
    expect(sql).toContain("CHECK (status IN ('pending', 'approved', 'rejected', 'revoked'))");
    expect(sql).toContain("CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))");
    expect(sql).toContain("CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show'))");
    expect(sql).toContain('UNIQUE (patient_id, professional_id, company_id)');
  });

  it('creates lookup indexes needed by services', () => {
    expect(sql).toContain('CREATE INDEX idx_ppl_patient');
    expect(sql).toContain('CREATE INDEX idx_ppl_professional');
    expect(sql).toContain('CREATE INDEX idx_ppl_approved');
    expect(sql).toContain('CREATE INDEX idx_ppl_invites_token');
    expect(sql).toContain('CREATE INDEX idx_bookings_professional');
    expect(sql).toContain('CREATE INDEX idx_bookings_date');
    expect(sql).toContain('CREATE INDEX idx_blocked_slots_professional');
  });
});
