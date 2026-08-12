import type { OperationalContext } from '@bbw/interfaces';

export function getOperationalContextTypeLabel(context: OperationalContext): string {
  return context.kind === 'personal_professional' ? 'Studio personale' : 'Organizzazione';
}

export function getOperationalContextRoleLabel(context: OperationalContext): string | null {
  if (context.kind === 'personal_professional') return context.professionalTypeDisplayName;
  return context.roles[0]?.displayName ?? null;
}

export function getOperationalContextId(context: OperationalContext): string {
  return context.kind === 'organization' ? context.organizationId : context.professionalProfileId;
}

export function getOperationalContextKey(context: OperationalContext): string {
  return `${context.kind}:${getOperationalContextId(context)}`;
}
