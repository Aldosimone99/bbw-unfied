import { describe, expect, it } from 'vitest';
import {
  operationalContextQuerySchema,
  operationalContextReferenceSchema,
  operationalContextSchema,
} from '../../schemas/operational-context-schema';

const organizationId = '00000000-0000-4000-8000-000000000003';

describe('operational context contracts', () => {
  it('validates discriminated personal and organization contexts', () => {
    expect(operationalContextSchema.parse({
      kind: 'personal_professional',
      professionalProfileId: '00000000-0000-4000-8000-000000000002',
      label: 'Studio Mario Rossi',
      professionalTypeCode: 'physician',
      professionalTypeDisplayName: 'Medico',
    }).kind).toBe('personal_professional');

    expect(operationalContextSchema.parse({
      kind: 'organization', organizationId, membershipId: '00000000-0000-4000-8000-000000000004',
      label: 'Clinica Aurora', organizationTypeCode: 'clinic', organizationTypeDisplayName: 'Clinica',
      roles: [{ code: 'practitioner', displayName: 'Professionista' }],
    }).kind).toBe('organization');
  });

  it('accepts only a minimal technical selection reference', () => {
    expect(operationalContextReferenceSchema.safeParse({ kind: 'organization', id: organizationId }).success).toBe(true);
    expect(operationalContextReferenceSchema.safeParse({ kind: 'organization', id: organizationId, role: 'organization_admin' }).success).toBe(false);
  });

  it('requires complete context query pairs', () => {
    expect(operationalContextQuerySchema.safeParse({ context_kind: 'organization', context_id: organizationId }).success).toBe(true);
    expect(operationalContextQuerySchema.safeParse({ context_kind: 'organization' }).success).toBe(false);
    expect(operationalContextQuerySchema.safeParse({ context_id: organizationId }).success).toBe(false);
  });
});
