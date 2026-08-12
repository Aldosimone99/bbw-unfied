import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function CatalogPage() {
  const context = await requirePlatformContext(["medico", "estetista", "clinica"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} organizationContext={context} activePath="/catalogo" eyebrow="Gestione" title="Catalogo" description="Trattamenti, servizi personalizzati e assegnazioni professionali." />;
}
