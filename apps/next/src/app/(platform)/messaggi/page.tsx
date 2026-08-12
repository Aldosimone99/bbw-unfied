import PlatformPlaceholder from '../../../features/dashboard/PlatformPlaceholder';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function MessagesPage() {
  const context = await requirePlatformContext(true);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} operationalContext={context} activePath="/messaggi" eyebrow="Comunicazione" title="Messaggi" description="Conversazioni, notifiche e comunicazioni operative del network BBW." />;
}
