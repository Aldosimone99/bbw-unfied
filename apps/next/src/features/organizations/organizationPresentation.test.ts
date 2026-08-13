import { describe, expect, it } from 'vitest';

import {
  getInvitationStatusLabel,
  getInvitationStatusTone,
  getMemberRoleLabel,
  getMemberStatusLabel,
  getMemberStatusTone,
  getOrganizationRoleLabel,
} from './organizationPresentation';

describe('organization presentation labels', () => {
  it('keeps technical role codes out of the user-facing label', () => {
    expect(getOrganizationRoleLabel({ code: 'practitioner', displayName: 'Practitioner' })).toBe('Medico');
    expect(getOrganizationRoleLabel({ code: 'clinical_operator', displayName: 'clinical_operator' })).toBe('Professionista');
    expect(getMemberRoleLabel([], true)).toBe('Responsabile organizzazione');
  });

  it('preserves multiple readable role labels without duplicates', () => {
    expect(getMemberRoleLabel([
      { code: 'practitioner', displayName: 'Practitioner' },
      { code: 'practitioner', displayName: 'Medico' },
    ], false)).toBe('Medico');
  });

  it('maps membership and invitation states to semantic presentation values', () => {
    expect(getMemberStatusLabel('active')).toBe('Attivo');
    expect(getMemberStatusTone('suspended')).toBe('error');
    expect(getInvitationStatusLabel('accepted')).toBe('Accettato');
    expect(getInvitationStatusTone('pending')).toBe('warning');
  });
});
