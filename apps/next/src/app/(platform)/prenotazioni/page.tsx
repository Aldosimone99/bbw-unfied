import PlatformPlaceholder from '../../../features/dashboard/PlatformPlaceholder';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function BookingsPage() {
  const context = await requirePlatformContext(true);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} operationalContext={context} activePath="/prenotazioni" eyebrow="Esperienza" title="Prenotazioni" description="Qui troverai le tue richieste e prenotazioni quando la sezione sarà attiva." />;
}
