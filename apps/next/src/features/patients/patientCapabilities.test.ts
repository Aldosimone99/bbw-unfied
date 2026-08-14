import { describe, expect, it } from 'vitest';

import type { OperationalContext } from '../../types/authorization';
import { canInvitePatients } from './patientCapabilities';

const organizationContext = {
  kind: 'organization',
  organizationId: '11111111-1111-4111-8111-111111111111',
  membershipId: '22222222-2222-4222-8222-222222222222',
  label: 'Clinica di test',
  organizationTypeCode: 'clinic',
  organizationTypeDisplayName: 'Clinica',
  roles: [],
} satisfies OperationalContext;

const personalProfessionalContext = {
  kind: 'personal_professional',
  professionalProfileId: '33333333-3333-4333-8333-333333333333',
  label: 'Profilo professionale',
  professionalTypeCode: 'physician',
  professionalTypeDisplayName: 'Medico',
} satisfies OperationalContext;

describe('patient capabilities', () => {
  it('allows patient invitations in an organization with patients.invite', () => {
    expect(canInvitePatients(organizationContext, ['patients.invite'])).toBe(true);
  });

  it('hides patient invitations when the permission is absent', () => {
    expect(canInvitePatients(organizationContext, ['patients.read'])).toBe(false);
  });

  it('hides organization invitations in a personal professional context', () => {
    expect(canInvitePatients(personalProfessionalContext, ['patients.invite'])).toBe(false);
  });

  it('hides patient invitations without an active context', () => {
    expect(canInvitePatients(null, ['patients.invite'])).toBe(false);
  });
});
