import type { OrganizationProfileUpdateRequest } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { getAuthorizationContext } from './authorization-context-service';
import type { ResolvedUser } from './types';

export class OrganizationProfileError extends Error {
  constructor(
    public readonly code: 'ORGANIZATION_NOT_FOUND' | 'ORGANIZATION_FORBIDDEN' | 'ORGANIZATION_PROFILE_UPDATE_FAILED',
    public readonly status: 403 | 404 | 500,
  ) {
    super(code);
    this.name = 'OrganizationProfileError';
  }
}

type OrganizationProfileRow = {
  id: string;
  legal_name: string | null;
  display_name: string;
  tax_identifier: string | null;
  email: string | null;
  phone: string | null;
  registered_address: unknown;
};

const organizationProfileColumns = 'id,legal_name,display_name,tax_identifier,email,phone,registered_address';

function definedUpdates(payload: OrganizationProfileUpdateRequest): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

async function assertOrganizationPermission(
  db: SupabaseLike,
  user: ResolvedUser,
  organizationId: string,
  permission: 'organization.read' | 'organization.update',
): Promise<void> {
  const context = await getAuthorizationContext(db, user, { requestedOrganizationId: organizationId });
  if (!context.activeOrganization || context.activeOrganization.organizationId !== organizationId) {
    throw new OrganizationProfileError('ORGANIZATION_NOT_FOUND', 404);
  }

  const canReadThroughUpdate = permission === 'organization.read'
    && context.organizationPermissions.includes('organization.update');
  if (!canReadThroughUpdate && !context.organizationPermissions.includes(permission)) {
    throw new OrganizationProfileError('ORGANIZATION_FORBIDDEN', 403);
  }
}

export async function getCurrentOrganizationProfile(
  db: SupabaseLike,
  user: ResolvedUser,
  organizationId: string,
) {
  await assertOrganizationPermission(db, user, organizationId, 'organization.read');

  const { data, error } = await db
    .from('organizations')
    .select(organizationProfileColumns)
    .eq('id', organizationId)
    .single();

  if (error || !data) throw new OrganizationProfileError('ORGANIZATION_NOT_FOUND', 404);
  const organization = data as OrganizationProfileRow;

  return {
    id: organization.id,
    legal_name: organization.legal_name,
    display_name: organization.display_name,
    tax_identifier: organization.tax_identifier,
    email: organization.email,
    phone: organization.phone,
    address: organization.registered_address,
  };
}

export async function updateCurrentOrganizationProfile(
  db: SupabaseLike,
  user: ResolvedUser,
  organizationId: string,
  payload: OrganizationProfileUpdateRequest,
) {
  await assertOrganizationPermission(db, user, organizationId, 'organization.update');

  const updates = definedUpdates(payload);
  if (Object.keys(updates).length === 0) return getCurrentOrganizationProfile(db, user, organizationId);

  const { error } = await db.rpc('update_organization_profile_with_audit', {
    p_actor_user_id: user.id,
    p_organization_id: organizationId,
    p_updates: updates,
  });
  if (error) {
    const status = error.message?.includes('ORGANIZATION_NOT_FOUND') ? 404 : 500;
    throw new OrganizationProfileError(
      status === 404 ? 'ORGANIZATION_NOT_FOUND' : 'ORGANIZATION_PROFILE_UPDATE_FAILED',
      status,
    );
  }

  return getCurrentOrganizationProfile(db, user, organizationId);
}
