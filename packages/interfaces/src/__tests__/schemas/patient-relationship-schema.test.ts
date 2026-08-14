import { describe, expect, it } from 'vitest';
import {
  createPatientRelationshipRequestSchema,
  patientLookupRequestSchema,
  patientRelationshipListSchema,
} from '../../schemas/patient-relationship-schema';

const subjectId = '11111111-1111-4111-8111-111111111111';
const relationshipId = '22222222-2222-4222-8222-222222222222';

const relationship = {
  relationshipId,
  subjectId,
  relationshipScope: 'organization' as const,
  organizationId: '33333333-3333-4333-8333-333333333333',
  professionalProfileId: null,
  originKind: 'organization' as const,
  originOrganizationId: '33333333-3333-4333-8333-333333333333',
  originProfessionalProfileId: null,
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario@example.com',
  phone: null,
  birthDate: null,
  status: 'active' as const,
  linkedAt: '2026-08-13T10:00:00.000Z',
  removedAt: null,
};

describe('patient relationship contracts', () => {
  it('requires exactly one exact lookup identifier', () => {
    expect(patientLookupRequestSchema.safeParse({ email: 'mario@example.com' }).success).toBe(true);
    expect(patientLookupRequestSchema.safeParse({ taxCode: 'RSSMRA80A01H501U' }).success).toBe(true);
    expect(patientLookupRequestSchema.safeParse({}).success).toBe(false);
    expect(patientLookupRequestSchema.safeParse({ email: 'mario@example.com', taxCode: 'RSSMRA80A01H501U' }).success).toBe(false);
  });

  it('keeps relationship scope and identity references explicit', () => {
    expect(patientRelationshipListSchema.parse({ relationshipScope: 'organization', items: [relationship], total: 1 })).toMatchObject({
      relationshipScope: 'organization',
      items: [{ relationshipId, subjectId, email: 'mario@example.com' }],
      total: 1,
    });
    expect(createPatientRelationshipRequestSchema.safeParse({ subjectId }).success).toBe(true);
    expect(createPatientRelationshipRequestSchema.safeParse({ subjectId, organizationId: relationship.organizationId }).success).toBe(false);
  });
});
