import PlatformPlaceholder from '../../../features/dashboard/PlatformPlaceholder';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function AvailabilityPage() {
  const context = await requirePlatformContext(true);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} operationalContext={context} activePath="/disponibilita" eyebrow="Agenda" title="Disponibilità" description="Orari settimanali, blocchi, sale e impostazioni di prenotazione." />;
}
