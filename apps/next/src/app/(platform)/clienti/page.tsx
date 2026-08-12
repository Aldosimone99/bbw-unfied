import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function ClientsPage() {
  const context = await requirePlatformContext(["medico", "estetista", "clinica", "commerciale"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} organizationContext={context} activePath="/clienti" eyebrow="Relazioni" title="Clienti" description="Clienti, collegamenti professionali e storico delle attività." />;
}
