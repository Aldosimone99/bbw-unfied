import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function MembersPage() {
  const context = await requirePlatformContext(["clinica"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} organizationContext={context} activePath="/membri" eyebrow="Organizzazione" title="Membri" description="Membri, ruoli e inviti della clinica o organizzazione attiva." />;
}
