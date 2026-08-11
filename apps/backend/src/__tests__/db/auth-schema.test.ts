import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260623_auth_otps.sql'),
  'utf8',
);

describe('auth schema', () => {
  it('creates otps table with TIMESTAMPTZ expires_at', () => {
    expect(migration).toContain('expires_at   TIMESTAMPTZ NOT NULL');
  });

  it('does not use BIGINT for expires_at', () => {
    expect(migration.toLowerCase()).not.toMatch(/expires_at\s+bigint/);
  });

  it('enforces purpose CHECK constraint with valid values', () => {
    expect(migration).toContain("CHECK (purpose IN ('registration', 'consent'))");
  });

  it('has the three required indexes', () => {
    expect(migration).toContain('idx_otps_email_purpose');
    expect(migration).toContain('idx_otps_reference');
    expect(migration).toContain('idx_otps_expires');
  });
});
