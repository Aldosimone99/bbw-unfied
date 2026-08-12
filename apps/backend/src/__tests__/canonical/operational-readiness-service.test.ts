import { describe, expect, it } from 'vitest';
import {
  checkCapabilityRequirements,
  getOperationalReadiness,
  getOrganizationCompleteness,
  getPersonalProfileCompleteness,
  getProfessionalReadiness,
} from '../../services/operational-readiness-service';

const completeAddress = {
  street: 'Via Roma 1',
  city: 'Milano',
  postal_code: '20100',
  country_code: 'IT',
} as const;

function completeReadiness() {
  return getOperationalReadiness({
    personalProfile: {
      firstName: 'Mario',
      lastName: 'Rossi',
      birthDate: '1990-01-01',
      taxCode: 'RSSMRA90A01H501U',
      address: completeAddress,
    },
    organization: {
      legalName: 'BBW S.r.l.',
      displayName: 'BBW Milano',
      organizationTypeId: 'organization-type-1',
      taxIdentifier: 'IT12345678901',
      email: 'info@example.com',
      phone: '+390212345678',
      address: completeAddress,
      hasActiveManager: true,
    },
    professionalProfiles: [{
      professionalTypeCode: 'physician',
      verificationRequired: true,
      verificationStatus: 'verified',
    }],
    professionalIntent: true,
  });
}

describe('personal profile completeness', () => {
  it('marks all required personal data as complete while keeping phone optional', () => {
    const result = getPersonalProfileCompleteness({
      firstName: 'Mario',
      lastName: 'Rossi',
      birthDate: '1990-01-01',
      taxCode: 'RSSMRA90A01H501U',
      address: completeAddress,
    });

    expect(result).toEqual({ complete: true, missing_fields: [] });
  });

  it('reports birth_date and tax_code independently when absent', () => {
    const result = getPersonalProfileCompleteness({
      firstName: 'Mario',
      lastName: 'Rossi',
      birthDate: null,
      taxCode: null,
      address: completeAddress,
    });

    expect(result).toEqual({
      complete: false,
      missing_fields: ['birth_date', 'tax_code'],
    });
  });

  it('returns every missing required field in deterministic order', () => {
    const result = getPersonalProfileCompleteness({
      firstName: null,
      lastName: null,
      birthDate: null,
      taxCode: null,
      address: null,
    });

    expect(result.missing_fields).toEqual(['first_name', 'last_name', 'birth_date', 'tax_code', 'address']);
  });
});

describe('organization completeness', () => {
  it('recognizes a complete organization with an active managing member', () => {
    expect(getOrganizationCompleteness({
      legalName: 'BBW S.r.l.',
      displayName: 'BBW Milano',
      organizationTypeId: 'organization-type-1',
      taxIdentifier: 'IT12345678901',
      email: 'info@example.com',
      phone: '+390212345678',
      address: completeAddress,
      hasActiveManager: true,
    })).toEqual({ applicable: true, complete: true, missing_fields: [] });
  });

  it('reports missing organization fields and a missing active manager', () => {
    const result = getOrganizationCompleteness({
      legalName: null,
      displayName: 'BBW Milano',
      organizationTypeId: 'organization-type-1',
      taxIdentifier: null,
      email: null,
      phone: null,
      address: null,
      hasActiveManager: false,
    });

    expect(result).toEqual({
      applicable: true,
      complete: false,
      missing_fields: ['legal_name', 'tax_identifier', 'email', 'phone', 'address', 'owner'],
    });
  });

  it('does not apply organization requirements when no authorized organization context exists', () => {
    expect(getOrganizationCompleteness(null)).toEqual({ applicable: false, complete: false, missing_fields: [] });
  });
});

describe('professional readiness', () => {
  it('allows a complete verified professional profile', () => {
    expect(getProfessionalReadiness([{
      professionalTypeCode: 'physician',
      verificationRequired: true,
      verificationStatus: 'verified',
    }], true)).toMatchObject({
      applicable: true,
      profile_complete: true,
      verification_status: 'verified',
      operational: true,
      blockers: [],
    });
  });

  it.each([
    ['pending', 'professional_verification_pending'],
    ['rejected', 'professional_verification_rejected'],
  ] as const)('blocks a %s professional verification', (verificationStatus, blocker) => {
    const result = getProfessionalReadiness([{
      professionalTypeCode: 'physician',
      verificationRequired: true,
      verificationStatus,
    }], true);

    expect(result).toMatchObject({ operational: false, blockers: [blocker] });
  });

  it('reports a missing professional profile only when the account declared professional intent', () => {
    expect(getProfessionalReadiness([], true)).toMatchObject({
      applicable: true,
      profile_complete: false,
      operational: false,
      blockers: ['professional_profile_missing'],
    });
    expect(getProfessionalReadiness([], false)).toMatchObject({ applicable: false, blockers: [] });
  });
});

describe('capability requirements', () => {
  it('allows a permission only when all declared readiness requirements are satisfied', () => {
    expect(checkCapabilityRequirements({
      permissionGranted: true,
      readiness: completeReadiness(),
      requirements: {
        personal_profile_complete: true,
        organization_profile_complete: true,
        professional_profile_complete: true,
        professional_verified: true,
      },
    })).toEqual({ allowed: true, error: null });
  });

  it('blocks a granted permission with a typed personal-profile error', () => {
    const readiness = completeReadiness();
    readiness.personal_profile = { complete: false, missing_fields: ['birth_date', 'tax_code'] };

    expect(checkCapabilityRequirements({
      permissionGranted: true,
      readiness,
      requirements: { personal_profile_complete: true },
    })).toEqual({
      allowed: false,
      error: { code: 'PERSONAL_PROFILE_INCOMPLETE', missingFields: ['birth_date', 'tax_code'] },
    });
  });

  it('keeps a missing permission distinct from readiness', () => {
    expect(checkCapabilityRequirements({
      permissionGranted: false,
      readiness: completeReadiness(),
      requirements: { personal_profile_complete: true },
    })).toEqual({ allowed: false, error: { code: 'FORBIDDEN' } });
  });

  it('requires an organization context before organization completeness can be enforced', () => {
    expect(checkCapabilityRequirements({
      permissionGranted: true,
      readiness: getOperationalReadiness({
        personalProfile: { firstName: 'Mario', lastName: 'Rossi', birthDate: '1990-01-01', taxCode: 'RSSMRA90A01H501U', address: completeAddress },
        organization: null,
        professionalProfiles: [],
        professionalIntent: false,
      }),
      requirements: { organization_profile_complete: true },
    })).toEqual({ allowed: false, error: { code: 'ORGANIZATION_CONTEXT_REQUIRED' } });
  });

  it('evaluates organization readiness independently for each selected context', () => {
    const organizationA = completeReadiness();
    const organizationB = completeReadiness();
    organizationB.organization = {
      applicable: true,
      complete: false,
      missing_fields: ['tax_identifier'],
    };

    expect(checkCapabilityRequirements({
      permissionGranted: true,
      readiness: organizationA,
      requirements: { organization_profile_complete: true },
    }).allowed).toBe(true);
    expect(checkCapabilityRequirements({
      permissionGranted: true,
      readiness: organizationB,
      requirements: { organization_profile_complete: true },
    })).toEqual({
      allowed: false,
      error: { code: 'ORGANIZATION_PROFILE_INCOMPLETE', missingFields: ['tax_identifier'] },
    });
  });
});
