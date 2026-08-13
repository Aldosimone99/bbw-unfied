import { forbidden } from 'next/navigation';

import PlatformShell from '../../../features/dashboard/PlatformShell';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';
import OrganizationMembers from '../../../features/organization-members/OrganizationMembers';

export default async function StaffPage() {
  const context = await requirePlatformContext(true);
  const activeContext = context.activeOperationalContext;
  if (activeContext?.kind !== 'organization' || !context.operationalPermissions.includes('organization.members.read')) forbidden();

  return (
    <PlatformShell
      user={context.user}
      profile={context.profile}
      activePath="/staff"
      operationalContext={context}
      permissions={context.permissions}
    >
      <OrganizationMembers
        canManage={context.operationalPermissions.includes('organization.members.manage')}
        canInvite={context.operationalPermissions.includes('organization.members.invite')}
      />
    </PlatformShell>
  );
}
