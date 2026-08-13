import { forbidden } from 'next/navigation';

import OrganizationMembers from '../../../features/organization-members/OrganizationMembers';
import PlatformShell from '../../../features/dashboard/PlatformShell';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function MembersPage() {
  const context = await requirePlatformContext(true);
  const activeContext = context.activeOperationalContext;
  if (activeContext?.kind !== 'organization' || !context.operationalPermissions.includes('organization.members.read')) forbidden();

  return <PlatformShell user={context.user} profile={context.profile} activePath="/membri" operationalContext={context} permissions={context.permissions}>
    <OrganizationMembers organizationName={activeContext.label} canManage={context.operationalPermissions.includes('organization.members.manage')} />
  </PlatformShell>;
}
