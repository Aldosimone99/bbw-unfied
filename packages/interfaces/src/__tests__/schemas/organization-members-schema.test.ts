import { describe, expect, it } from 'vitest';
import { organizationMemberSchema } from '../../schemas/organization-members-schema';

describe('organization member contracts', () => {
  it('exposes backend-derived owner capability without trusting a role label in the UI', () => {
    const member = organizationMemberSchema.parse({
      membershipId: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      email: 'owner@example.com',
      firstName: 'Giulia',
      lastName: 'Bianchi',
      status: 'active',
      joinedAt: '2026-08-12T10:00:00.000Z',
      roles: [{ code: 'organization_owner', displayName: 'Owner della struttura' }],
      isOrganizationOwner: true,
    });

    expect(member.isOrganizationOwner).toBe(true);
  });
});
