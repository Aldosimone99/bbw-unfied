import { forbidden } from 'next/navigation';

import OrganizationInvitations from '../../../features/organization-invitations/OrganizationInvitations';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function InvitesPage() {
  const context = await requirePlatformContext(true);
  const activeContext = context.activeOperationalContext;
  if (
    activeContext?.kind !== 'organization'
    || !context.operationalPermissions.includes('organization.members.invite')
  ) {
    forbidden();
  }

  return <OrganizationInvitations organizationName={activeContext.label} />;
}
