export type OrganizationRolePresentation = {
  code: string;
  displayName: string;
};

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error';

const roleLabels: Record<string, string> = {
  organization_owner: 'Responsabile organizzazione',
  practitioner: 'Medico',
};

const internalRoleLabels: Record<string, string> = {
  'organization owner': 'Responsabile organizzazione',
  owner: 'Responsabile organizzazione',
  practitioner: 'Medico',
};

const memberStatusLabels = {
  pending: 'In attesa',
  active: 'Attivo',
  suspended: 'Sospeso',
  revoked: 'Rimosso',
} as const;

const invitationStatusLabels = {
  pending: 'In attesa',
  accepted: 'Accettato',
  revoked: 'Revocato',
  expired: 'Scaduto',
} as const;

export type MemberStatus = keyof typeof memberStatusLabels;
export type InvitationStatus = keyof typeof invitationStatusLabels;

export function getOrganizationRoleLabel(role: OrganizationRolePresentation): string {
  const mappedLabel = roleLabels[role.code];
  if (mappedLabel) return mappedLabel;

  const normalizedDisplayName = role.displayName.trim();
  const normalizedDisplayNameKey = normalizedDisplayName.toLocaleLowerCase('it');
  if (internalRoleLabels[normalizedDisplayNameKey]) return internalRoleLabels[normalizedDisplayNameKey];
  if (!normalizedDisplayName || normalizedDisplayNameKey === role.code.toLocaleLowerCase('it') || /[._]/.test(normalizedDisplayName)) {
    return 'Professionista';
  }
  return normalizedDisplayName;
}

export function getMemberRoleLabel(
  roles: readonly OrganizationRolePresentation[],
  isOrganizationOwner: boolean,
): string {
  const labels = roles.map(getOrganizationRoleLabel).filter(Boolean);
  if (isOrganizationOwner && !labels.includes(roleLabels.organization_owner)) {
    labels.unshift(roleLabels.organization_owner);
  }

  return [...new Set(labels)].join(', ') || 'Professionista';
}

export function getMemberStatusLabel(status: MemberStatus): string {
  return memberStatusLabels[status];
}

export function getMemberStatusTone(status: MemberStatus): StatusTone {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'suspended') return 'error';
  return 'neutral';
}

export function getInvitationStatusLabel(status: InvitationStatus): string {
  return invitationStatusLabels[status];
}

export function getInvitationStatusTone(status: InvitationStatus): StatusTone {
  if (status === 'accepted') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'expired') return 'error';
  return 'neutral';
}
