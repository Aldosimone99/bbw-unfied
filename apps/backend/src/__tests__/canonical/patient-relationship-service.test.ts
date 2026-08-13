import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseLike } from '../../db/supabase';
import { getAuthorizationContext } from '../../services/authorization-context-service';
import {
  createPatientRelationship,
  listPatientRelationships,
  lookupPatient,
  removePatientRelationship,
} from '../../services/patient-relationship-service';

vi.mock('../../services/authorization-context-service', () => ({
  getAuthorizationContext: vi.fn(),
}));

const mockedGetAuthorizationContext = vi.mocked(getAuthorizationContext);
const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'doctor@example.com', tipo_utente: 'privato' as const };
const organizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const professionalProfileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const subjectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const relationshipId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const orgContext = { kind: 'organization' as const, organizationId, membershipId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', label: 'Clinica Aurora', organizationTypeCode: 'clinic', organizationTypeDisplayName: 'Clinica', roles: [] };
const personalContext = { kind: 'personal_professional' as const, professionalProfileId, label: 'Studio personale', professionalTypeCode: 'physician', professionalTypeDisplayName: 'Medico' };
const row = {
  relationship_id: relationshipId,
  subject_id: subjectId,
  organization_id: organizationId,
  professional_profile_id: null,
  first_name: 'Mario',
  last_name: 'Rossi',
  email: 'mario@example.com',
  phone: '+390212345678',
  birth_date: '1980-01-01',
  status: 'active',
  linked_at: '2026-08-13T10:00:00.000Z',
  removed_at: null,
};

function makeDb(rpc: (name: string, args: Record<string, unknown>) => unknown): SupabaseLike {
  return { rpc: vi.fn(async (name: string, args: Record<string, unknown>) => rpc(name, args)) } as unknown as SupabaseLike;
}

function authorize(activeOperationalContext: typeof orgContext | typeof personalContext, permissions: string[]) {
  mockedGetAuthorizationContext.mockResolvedValue({ activeOperationalContext, operationalPermissions: permissions } as never);
}

describe('patient relationship service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists only the organization scope and never trusts another organization identifier', async () => {
    authorize(orgContext, ['patients.read']);
    const db = makeDb((name, args) => {
      expect(name).toBe('list_organization_patient_relationships');
      expect(args).toEqual({ p_organization_id: organizationId });
      return { data: [row], error: null };
    });

    const result = await listPatientRelationships(db, user, { kind: 'organization', id: organizationId });
    expect(result.items[0]).toMatchObject({ relationshipId, subjectId, relationshipScope: 'organization' });

    authorize({ ...orgContext, organizationId: '11111111-1111-4111-8111-111111111111' }, ['patients.read']);
    await expect(listPatientRelationships(db, user, { kind: 'organization', id: organizationId })).rejects.toMatchObject({ code: 'OPERATIONAL_CONTEXT_FORBIDDEN', status: 403 });
  });

  it('keeps personal professional relationships separate from organization relationships', async () => {
    authorize(personalContext, ['patients.read', 'patients.link', 'patients.unlink']);
    const personalRow = { ...row, organization_id: null, professional_profile_id: professionalProfileId };
    const db = makeDb((name, args) => {
      if (name === 'link_professional_patient') {
        expect(args).toMatchObject({ p_professional_profile_id: professionalProfileId, p_subject_id: subjectId });
        return { data: relationshipId, error: null };
      }
      if (name === 'list_professional_patient_relationships') return { data: [personalRow], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });

    const result = await createPatientRelationship(db, user, { kind: 'personal_professional', id: professionalProfileId }, { subjectId });
    expect(result).toMatchObject({ relationshipId, subjectId, relationshipScope: 'personal_professional', professionalProfileId });
    expect(mockedGetAuthorizationContext).toHaveBeenCalledWith(db, user, { requestedOperationalContext: { kind: 'personal_professional', id: professionalProfileId } });
  });

  it('requires link permission for exact lookup and does not call the database otherwise', async () => {
    authorize(orgContext, ['patients.read']);
    const db = makeDb(() => { throw new Error('RPC must not be called'); });

    await expect(lookupPatient(db, user, { kind: 'organization', id: organizationId }, { email: 'mario@example.com' })).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it('unlinks only a relationship in the active professional scope', async () => {
    authorize(personalContext, ['patients.unlink']);
    const db = makeDb((name, args) => {
      expect(name).toBe('remove_professional_patient_relationship');
      expect(args).toEqual({ p_actor_user_id: user.id, p_professional_profile_id: professionalProfileId, p_relationship_id: relationshipId });
      return { data: relationshipId, error: null };
    });

    await expect(removePatientRelationship(db, user, { kind: 'personal_professional', id: professionalProfileId }, relationshipId)).resolves.toEqual({ relationshipId, status: 'removed' });
  });
});
