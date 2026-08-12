import PlatformPlaceholder from '../../../features/dashboard/PlatformPlaceholder';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function HistoryPage() {
  const context = await requirePlatformContext(true);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} operationalContext={context} activePath="/storico" eyebrow="Account" title="Storico" description="Storico delle attività nel contesto operativo selezionato." />;
}
