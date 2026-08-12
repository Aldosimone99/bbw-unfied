import { describe, expect, it } from 'vitest';
import {
  operationalReadinessSchema,
  organizationProfileUpdateRequestSchema,
  personalProfileUpdateRequestSchema,
} from '../../schemas/operational-readiness-schema';

const address = {
  street: 'Via Roma 1',
  city: 'Milano',
  postal_code: '20100',
  country_code: 'it',
};

describe('operational readiness contracts', () => {
  it('normalizes canonical profile and organization input without a completion flag', () => {
    expect(personalProfileUpdateRequestSchema.parse({
      first_name: 'Mario',
      birth_date: '1990-01-01',
      tax_code: 'rssmra90a01h501u',
      address,
    })).toMatchObject({ tax_code: 'RSSMRA90A01H501U', address: { country_code: 'IT' } });

    expect(organizationProfileUpdateRequestSchema.parse({
      legal_name: 'BBW S.r.l.',
      email: 'info@example.com',
      address,
    })).toMatchObject({ legal_name: 'BBW S.r.l.', address: { country_code: 'IT' } });
  });

  it('rejects a partial address instead of treating it as complete', () => {
    expect(personalProfileUpdateRequestSchema.safeParse({
      address: { street: 'Via Roma 1' },
    }).success).toBe(false);
  });

  it('validates the readiness response shape with technical missing field identifiers', () => {
    expect(operationalReadinessSchema.parse({
      personal_profile: { complete: false, missing_fields: ['birth_date', 'tax_code'] },
      organization: { applicable: false, complete: false, missing_fields: [] },
      professional: {
        applicable: true,
        profile_complete: true,
        verification_status: 'pending',
        operational: false,
        blockers: ['professional_verification_pending'],
        profiles: [{
          professional_type_code: 'physician',
          profile_complete: true,
          verification_required: true,
          verification_status: 'pending',
          operational: false,
          blockers: ['professional_verification_pending'],
        }],
      },
    })).toMatchObject({
      personal_profile: { missing_fields: ['birth_date', 'tax_code'] },
      professional: { operational: false },
    });
  });
});
