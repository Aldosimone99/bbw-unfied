import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function StaffPage() {
  const context = await requirePlatformContext(["clinica"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} permissions={context.permissions} organizationContext={context} activePath="/staff" eyebrow="Organizzazione" title="Staff" description="Gestione del team e delle responsabilità operative della struttura." />;
}
