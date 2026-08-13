import type {
  AddressInput,
  OperationalContext,
  OperationalContextKind,
  OperationalContextReference,
  OperationalContextRole,
  OperationalReadiness,
} from '@bbw/interfaces';

export const permissionCodes = [
  'dashboard.access',
  'platform.admin.access',
  'profile.read_own',
  'profile.update_own',
  'organization.create',
  'organization.read',
  'organization.update',
  'organization.members.read',
  'organization.members.invite',
  'organization.members.manage',
  'patients.read',
  'patients.link',
  'patients.unlink',
  'professional_profile.create',
  'professional_profile.read_own',
  'professional_profile.update_own',
  'professional_profile.verify',
  'audit.read',
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export const accountTypeCodes = [
  'personal',
  'professional',
  'healthcare_professional',
  'beauty_professional',
  'organization',
  'commercial',
] as const;

export type AccountTypeCode = (typeof accountTypeCodes)[number];
export type OnboardingStatus = 'profile_required' | 'account_type_required' | 'context_required' | 'completed' | 'suspended';
export type AccountTypeStatus = 'not_required' | 'pending' | 'approved' | 'rejected';
export type { OperationalContext, OperationalContextKind, OperationalContextReference, OperationalContextRole };

export type CurrentUser = {
  id: string;
  email: string | null;
};

export type ProfileSummary = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  birthDate: string | null;
  taxCode: string | null;
  address: AddressInput | null;
  requestedAccountType: AccountTypeCode | null;
  /** Legacy display metadata only; it never authorizes an operation. */
  operationalRole?: 'admin' | 'medico' | 'estetista' | 'commerciale' | 'clinica' | 'cliente' | null;
  accountTypeStatus: AccountTypeStatus;
  onboardingStatus: OnboardingStatus;
};

export type RoleSummary = OperationalContextRole;

export type OperationalContextSummary = {
  availableOperationalContexts: OperationalContext[];
  activeOperationalContext: OperationalContext | null;
  platformRoles: RoleSummary[];
  operationalRoles: RoleSummary[];
};

export type ReadinessContext = OperationalReadiness;
