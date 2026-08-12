import DashboardView from '../../../features/dashboard/DashboardView';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function DashboardPage() {
  const context = await requirePlatformContext();
  return (
    <DashboardView
      user={context.user}
      profile={context.profile}
      operationalContext={context}
      permissions={context.permissions}
      readiness={context.readiness!}
    />
  );
}
