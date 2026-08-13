import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260813000800_backfill_patient_permissions.sql'),
  'utf8',
);

describe('patient permission backfill migration', () => {
  it('provisions the canonical patient permissions', () => {
    expect(migration).toContain("'patients.read'");
    expect(migration).toContain("'patients.link'");
    expect(migration).toContain("'patients.invite'");
    expect(migration).toContain("'patients.unlink'");
  });

  it('grants patients.read to the organization roles that can access patients', () => {
    for (const roleCode of [
      'organization_owner',
      'organization_admin',
      'clinical_director',
      'office_manager',
    ]) {
      expect(migration).toContain(`('${roleCode}', 'patients.read')`);
    }
  });

  it('does not grant patients.read to roles without patient access', () => {
    for (const roleCode of ['practitioner', 'staff', 'finance']) {
      expect(migration).not.toContain(`('${roleCode}', 'patients.read')`);
    }
  });
});
