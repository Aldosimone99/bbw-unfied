import { forbidden } from 'next/navigation';

import OrganizationProfileView from '../../../features/organizations/OrganizationProfileView';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';
import { getOwnOrganizationProfile } from '../../../server/services/organization-profile-service';

export default async function OrganizationPage() {
  const context = await requirePlatformContext();
  const activeContext = context.activeOperationalContext;
  if (activeContext?.kind !== 'organization' || !context.operationalPermissions.includes('organization.update')) forbidden();

  const organization = await getOwnOrganizationProfile(activeContext.organizationId);
  return <OrganizationProfileView user={context.user} profile={context.profile} operationalContext={context} permissions={context.permissions} readiness={context.readiness!} organization={organization} />;
}
