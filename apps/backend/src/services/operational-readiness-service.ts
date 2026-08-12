import type {
  AddressInput,
  OperationalReadiness,
  OperationalReadinessErrorCode,
  OperationalRequirement,
  OrganizationReadiness,
  PersonalProfileReadiness,
  ProfessionalReadiness,
} from '@bbw/interfaces';

export type PersonalProfileReadinessInput = {
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  taxCode: string | null;
  address: AddressInput | null;
};

export type OrganizationReadinessInput = {
  legalName: string | null;
  displayName: string | null;
  organizationTypeId: string | null;
  taxIdentifier: string | null;
  email: string | null;
  phone: string | null;
  address: AddressInput | null;
  hasActiveManager: boolean;
} | null;

export type ProfessionalReadinessInput = {
  professionalTypeCode: string;
  verificationRequired: boolean;
  verificationStatus: 'draft' | 'pending' | 'verified' | 'rejected' | 'suspended';
};

export type OperationalReadinessInput = {
  personalProfile: PersonalProfileReadinessInput;
  organization: OrganizationReadinessInput;
  professionalProfiles: ProfessionalReadinessInput[];
  professionalIntent: boolean;
};

export type CapabilityRequirementsInput = {
  permissionGranted: boolean;
  requirements: OperationalRequirement;
  readiness: OperationalReadiness;
};

export type CapabilityRequirementsResult = {
  allowed: boolean;
  error: {
    code: OperationalReadinessErrorCode | 'FORBIDDEN';
    missingFields?: string[];
    blockers?: string[];
  } | null;
};

export class OperationalReadinessError extends Error {
  readonly status = 422;

  constructor(
    public readonly code: OperationalReadinessErrorCode,
    public readonly missingFields: string[] = [],
    public readonly blockers: string[] = [],
  ) {
    super(code);
    this.name = 'OperationalReadinessError';
  }
}

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

function hasAddress(value: AddressInput | null): boolean {
  return value !== null
    && hasText(value.street)
    && hasText(value.city)
    && hasText(value.postal_code)
    && hasText(value.country_code);
}

export function getPersonalProfileCompleteness(input: PersonalProfileReadinessInput): PersonalProfileReadiness {
  const missingFields: Array<'first_name' | 'last_name' | 'birth_date' | 'tax_code' | 'address'> = [];

  if (!hasText(input.firstName)) missingFields.push('first_name');
  if (!hasText(input.lastName)) missingFields.push('last_name');
  if (!hasText(input.birthDate)) missingFields.push('birth_date');
  if (!hasText(input.taxCode)) missingFields.push('tax_code');
  if (!hasAddress(input.address)) missingFields.push('address');

  return {
    complete: missingFields.length === 0,
    missing_fields: missingFields,
  };
}

export function getOrganizationCompleteness(input: OrganizationReadinessInput): OrganizationReadiness {
  if (!input) {
    return { applicable: false, complete: false, missing_fields: [] };
  }

  const missingFields: Array<'legal_name' | 'display_name' | 'organization_type' | 'tax_identifier' | 'email' | 'phone' | 'address' | 'owner'> = [];

  if (!hasText(input.legalName)) missingFields.push('legal_name');
  if (!hasText(input.displayName)) missingFields.push('display_name');
  if (!hasText(input.organizationTypeId)) missingFields.push('organization_type');
  if (!hasText(input.taxIdentifier)) missingFields.push('tax_identifier');
  if (!hasText(input.email)) missingFields.push('email');
  if (!hasText(input.phone)) missingFields.push('phone');
  if (!hasAddress(input.address)) missingFields.push('address');
  if (!input.hasActiveManager) missingFields.push('owner');

  return {
    applicable: true,
    complete: missingFields.length === 0,
    missing_fields: missingFields,
  };
}

function getProfessionalProfileReadiness(input: ProfessionalReadinessInput) {
  const blockers: Array<'professional_verification_required' | 'professional_verification_pending' | 'professional_verification_rejected' | 'professional_verification_suspended'> = [];
  const operational = !input.verificationRequired || input.verificationStatus === 'verified';

  if (!operational) {
    if (input.verificationStatus === 'pending') blockers.push('professional_verification_pending');
    else if (input.verificationStatus === 'rejected') blockers.push('professional_verification_rejected');
    else if (input.verificationStatus === 'suspended') blockers.push('professional_verification_suspended');
    else blockers.push('professional_verification_required');
  }

  return {
    professional_type_code: input.professionalTypeCode,
    profile_complete: true,
    verification_required: input.verificationRequired,
    verification_status: input.verificationStatus,
    operational,
    blockers,
  };
}

export function getProfessionalReadiness(
  profiles: ProfessionalReadinessInput[],
  professionalIntent: boolean,
): ProfessionalReadiness {
  const profileReadiness = profiles.map(getProfessionalProfileReadiness);
  const operationalProfile = profileReadiness.find((profile) => profile.operational) ?? null;
  const singleProfile = profileReadiness.length === 1 ? profileReadiness[0] : null;
  const applicable = professionalIntent || profiles.length > 0;

  if (!applicable) {
    return {
      applicable: false,
      profile_complete: false,
      verification_status: null,
      operational: false,
      blockers: [],
      profiles: [],
    };
  }

  if (profiles.length === 0) {
    return {
      applicable: true,
      profile_complete: false,
      verification_status: null,
      operational: false,
      blockers: ['professional_profile_missing'],
      profiles: [],
    };
  }

  return {
    applicable: true,
    profile_complete: true,
    verification_status: singleProfile?.verification_status ?? operationalProfile?.verification_status ?? null,
    operational: operationalProfile !== null,
    blockers: operationalProfile ? [] : [...new Set(profileReadiness.flatMap((profile) => profile.blockers))],
    profiles: profileReadiness,
  };
}

export function getOperationalReadiness(input: OperationalReadinessInput): OperationalReadiness {
  return {
    personal_profile: getPersonalProfileCompleteness(input.personalProfile),
    organization: getOrganizationCompleteness(input.organization),
    professional: getProfessionalReadiness(input.professionalProfiles, input.professionalIntent),
  };
}

export function checkCapabilityRequirements(input: CapabilityRequirementsInput): CapabilityRequirementsResult {
  if (!input.permissionGranted) {
    return { allowed: false, error: { code: 'FORBIDDEN' } };
  }

  const { requirements, readiness } = input;
  if (requirements.personal_profile_complete && !readiness.personal_profile.complete) {
    return {
      allowed: false,
      error: {
        code: 'PERSONAL_PROFILE_INCOMPLETE',
        missingFields: readiness.personal_profile.missing_fields,
      },
    };
  }

  if (requirements.organization_profile_complete && !readiness.organization.applicable) {
    return { allowed: false, error: { code: 'ORGANIZATION_CONTEXT_REQUIRED' } };
  }

  if (requirements.organization_profile_complete && !readiness.organization.complete) {
    return {
      allowed: false,
      error: {
        code: 'ORGANIZATION_PROFILE_INCOMPLETE',
        missingFields: readiness.organization.missing_fields,
      },
    };
  }

  if (requirements.professional_profile_complete && !readiness.professional.profile_complete) {
    return {
      allowed: false,
      error: {
        code: 'PROFESSIONAL_PROFILE_INCOMPLETE',
        blockers: readiness.professional.blockers,
      },
    };
  }

  if (requirements.professional_verified && !readiness.professional.operational) {
    return {
      allowed: false,
      error: {
        code: 'PROFESSIONAL_NOT_VERIFIED',
        blockers: readiness.professional.blockers,
      },
    };
  }

  return { allowed: true, error: null };
}

export function requireOperationalReadiness(input: CapabilityRequirementsInput): void {
  const result = checkCapabilityRequirements(input);
  if (result.allowed || !result.error) return;

  if (result.error.code === 'FORBIDDEN') {
    const error = new Error('FORBIDDEN');
    error.name = 'CapabilityAuthorizationError';
    throw error;
  }

  throw new OperationalReadinessError(
    result.error.code,
    result.error.missingFields ?? [],
    result.error.blockers ?? [],
  );
}
