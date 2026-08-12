import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function ConsentsPage() {
  const context = await requirePlatformContext(["cliente", "medico", "estetista", "clinica"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} organizationContext={context} activePath="/consensi" eyebrow="Sicurezza" title="Consensi" description="Documenti, firme e consensi informati collegati ai trattamenti." />;
}
