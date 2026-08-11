import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function HistoryPage() {
  const context = await requirePlatformContext(["cliente"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} organizationContext={context} activePath="/storico" eyebrow="Account" title="Storico" description="Storico dei trattamenti e delle attività del tuo profilo." />;
}
