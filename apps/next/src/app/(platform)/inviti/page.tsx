import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function InvitesPage() {
  const context = await requirePlatformContext(["cliente", "medico", "estetista", "clinica", "commerciale"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} organizationContext={context} activePath="/inviti" eyebrow="Network" title="Inviti" description="Inviti a clienti, professionisti e collaboratori del tuo contesto." />;
}
