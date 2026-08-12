import type { AddressInput, OperationalReadiness } from '@bbw/interfaces';

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
  /** Operational role granted by the backend; a requested account type is not sufficient. */
  operationalRole?: 'admin' | 'medico' | 'estetista' | 'commerciale' | 'clinica' | 'cliente' | null;
  accountTypeStatus: AccountTypeStatus;
  onboardingStatus: OnboardingStatus;
};

export type MembershipRole = {
  code: string;
  displayName: string;
};

export type MembershipSummary = {
  id: string;
  organizationId: string;
  organizationDisplayName: string | null;
  organizationTypeCode: string | null;
  organizationTypeDisplayName: string | null;
  organizationStatus: string | null;
  status: string;
  joinedAt: string | null;
  roles: MembershipRole[];
};

export type OrganizationContextSummary = {
  memberships: MembershipSummary[];
  activeOrganization: MembershipSummary | null;
};

export type ReadinessContext = OperationalReadiness;
