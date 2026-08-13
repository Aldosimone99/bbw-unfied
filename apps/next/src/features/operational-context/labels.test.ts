import { describe, expect, it } from 'vitest';
import type { OperationalContext } from '@bbw/interfaces';

import { getOperationalContextDescription, getOperationalContextRoleLabel } from './labels';

const personalContext = (label: string): OperationalContext => ({
  kind: 'personal_professional',
  professionalProfileId: '00000000-0000-4000-8000-000000000001',
  label,
  professionalTypeCode: 'physician',
  professionalTypeDisplayName: 'Medico',
});

const organizationContext: OperationalContext = {
  kind: 'organization',
  organizationId: '00000000-0000-4000-8000-000000000002',
  membershipId: '00000000-0000-4000-8000-000000000003',
  label: 'Clinica Di Rosa',
  organizationTypeCode: 'clinic',
  organizationTypeDisplayName: 'Clinica',
  roles: [{ code: 'practitioner', displayName: 'Practitioner' }],
};

describe('operational context labels', () => {
  it('does not repeat Medico when the personal context title is already Medico', () => {
    expect(getOperationalContextRoleLabel(personalContext('Medico'))).toBeNull();
  });

  it('shows Medico once when the personal workspace has a custom studio name', () => {
    expect(getOperationalContextRoleLabel(personalContext('Studio Di Rosa'))).toBe('Medico');
  });

  it('translates the internal practitioner role to Medico for organization contexts', () => {
    expect(getOperationalContextRoleLabel(organizationContext)).toBe('Medico');
  });
});

  it('describes shared and personal spaces in user-facing language', () => {
    expect(getOperationalContextDescription(personalContext('Il tuo studio'))).toContain('attività professionale');
    expect(getOperationalContextDescription(organizationContext)).toContain('team');
  });