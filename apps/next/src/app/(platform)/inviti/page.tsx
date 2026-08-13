import { forbidden } from 'next/navigation';

import OrganizationInvitations from '../../../features/organization-invitations/OrganizationInvitations';
import PlatformShell from '../../../features/dashboard/PlatformShell';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function InvitesPage() {
  const context = await requirePlatformContext(true);
  const activeContext = context.activeOperationalContext;
  if (activeContext?.kind !== 'organization' || !context.operationalPermissions.includes('organization.members.invite')) forbidden();

  return <PlatformShell user={context.user} profile={context.profile} activePath="/inviti" operationalContext={context} permissions={context.permissions}>
    <OrganizationInvitations />
  </PlatformShell>;
}
