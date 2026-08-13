import type { OperationalContext } from '@bbw/interfaces';

export function getOperationalContextTypeLabel(context: OperationalContext): string {
  return context.kind === 'personal_professional' ? 'Studio personale' : 'Organizzazione';
}

export function getOperationalContextRoleLabel(context: OperationalContext): string | null {
  if (context.kind === 'personal_professional') {
    return context.label.trim().toLocaleLowerCase('it') === context.professionalTypeDisplayName.trim().toLocaleLowerCase('it')
      ? null
      : context.professionalTypeDisplayName;
  }

  const practitionerRole = context.roles.find((role) => role.code === 'practitioner');
  if (practitionerRole) return 'Medico';
  return context.roles[0]?.displayName ?? null;
}

export function getOperationalContextDescription(context: OperationalContext): string {
  return context.kind === 'personal_professional'
    ? 'Gestisci la tua attività professionale e i tuoi appuntamenti personali.'
    : 'Lavora con il team e accedi alle attività condivise della struttura.';
}

export function getOperationalContextId(context: OperationalContext): string {
  return context.kind === 'organization' ? context.organizationId : context.professionalProfileId;
}

export function getOperationalContextKey(context: OperationalContext): string {
  return `${context.kind}:${getOperationalContextId(context)}`;
}
