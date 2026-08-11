import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function AvailabilityPage() {
  const context = await requirePlatformContext(["medico", "estetista", "clinica"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} organizationContext={context} activePath="/disponibilita" eyebrow="Agenda" title="Disponibilità" description="Orari settimanali, blocchi, sale e impostazioni di prenotazione." />;
}
