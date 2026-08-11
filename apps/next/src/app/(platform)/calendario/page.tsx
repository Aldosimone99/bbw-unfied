import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function CalendarPage() {
  const context = await requirePlatformContext();
  return <PlatformPlaceholder user={context.user} profile={context.profile} organizationContext={context} activePath="/calendario" eyebrow="Esperienza" title="Calendario" description="Il tuo calendario personale sarà organizzato qui in modo semplice e chiaro." />;
}
