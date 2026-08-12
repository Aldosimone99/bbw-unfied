import { describe, expect, it, vi } from 'vitest';
import { createOwnProfessionalProfile, requestProfessionalVerification } from '../../services/professional-profile-service';

function builder(result: unknown) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
  };
  return query;
}

const professionalType = {
  id: 'type-physician',
  code: 'physician',
  category: 'healthcare',
  display_name: 'Medico',
  verification_required: true,
};

describe('canonical professional profile service', () => {
  it('creates a draft profile without self-assigning verification', async () => {
    const typeQuery = builder({ data: professionalType, error: null });
    const profileQuery = builder({
      data: {
        id: 'profile-1',
        user_id: 'user-1',
        display_name: 'Dott. Mario Rossi',
        bio: null,
        verification_status: 'draft',
        verified_at: null,
        professional_types: professionalType,
      },
      error: null,
    });
    const db = { from: vi.fn((table: string) => table === 'professional_types' ? typeQuery : profileQuery) } as any;

    const result = await createOwnProfessionalProfile(db, 'user-1', {
      professional_type_code: 'physician',
      display_name: 'Dott. Mario Rossi',
    });

    expect(profileQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      professional_type_id: 'type-physician',
      verification_status: 'draft',
    }));
    expect(result.verificationStatus).toBe('draft');
    expect(result.verifiedAt).toBeNull();
  });

  it('only moves draft or rejected profiles to pending verification', async () => {
    const profileQuery = builder({
      data: {
        id: 'profile-1',
        user_id: 'user-1',
        verification_status: 'pending',
        professional_types: professionalType,
      },
      error: null,
    });
    const result = await requestProfessionalVerification({ from: vi.fn(() => profileQuery) } as any, 'user-1', 'profile-1');
    expect(profileQuery.in).toHaveBeenCalledWith('verification_status', ['draft', 'rejected']);
    expect(result.verificationStatus).toBe('pending');
  });
});
