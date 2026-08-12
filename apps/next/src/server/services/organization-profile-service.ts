import { addressInputSchema, type AddressInput, type OrganizationProfileUpdateRequest } from '@bbw/interfaces';

import { AppError, UnauthenticatedError } from '../../lib/errors/app-error';
import { requestTransitionBackend } from '../auth/transition-session';

export type OrganizationProfile = {
  id: string;
  legal_name: string | null;
  display_name: string | null;
  tax_identifier: string | null;
  email: string | null;
  phone: string | null;
  address: AddressInput | null;
};

function parseOrganizationProfile(value: unknown): OrganizationProfile | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string') return null;

  const address = addressInputSchema.safeParse(row.address);
  return {
    id: row.id,
    legal_name: typeof row.legal_name === 'string' ? row.legal_name : null,
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    tax_identifier: typeof row.tax_identifier === 'string' ? row.tax_identifier : null,
    email: typeof row.email === 'string' ? row.email : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    address: address.success ? address.data : null,
  };
}

export async function getOwnOrganizationProfile(organizationId: string): Promise<OrganizationProfile> {
  const response = await requestTransitionBackend<unknown>(`/organizations/${organizationId}/profile`);
  if (response.status === 401) throw new UnauthenticatedError();
  if (response.status === 403 || response.status === 404) throw new AppError('FORBIDDEN', 'Organization access is not allowed.');
  if (!response.ok || !response.data || typeof response.data !== 'object') {
    throw new AppError('INFRASTRUCTURE', 'Organization profile could not be loaded.');
  }

  const payload = response.data as { data?: unknown };
  const profile = parseOrganizationProfile(payload.data);
  if (!profile) throw new AppError('INFRASTRUCTURE', 'Organization profile response is invalid.');
  return profile;
}

export async function updateOwnOrganizationProfile(
  organizationId: string,
  input: OrganizationProfileUpdateRequest,
): Promise<void> {
  const response = await requestTransitionBackend(`/organizations/${organizationId}/profile`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (response.status === 401) throw new UnauthenticatedError();
  if (response.status === 403 || response.status === 404) throw new AppError('FORBIDDEN', 'Organization access is not allowed.');
  if (!response.ok) throw new AppError('INFRASTRUCTURE', 'Organization profile could not be updated.');
}
