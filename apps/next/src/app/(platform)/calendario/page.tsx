import PlatformPlaceholder from '../../../features/dashboard/PlatformPlaceholder';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function CalendarPage() {
  const context = await requirePlatformContext(true);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} operationalContext={context} activePath="/calendario" eyebrow="Esperienza" title="Agenda" description="La tua agenda operativa sarà organizzata qui in modo semplice e chiaro." />;
}
