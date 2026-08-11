import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function ReportsPage() {
  const context = await requirePlatformContext(["commerciale"]);
  return <PlatformPlaceholder user={context.user} profile={context.profile} organizationContext={context} activePath="/report" eyebrow="Commerciale" title="Report" description="Indicatori e riepiloghi per il percorso commerciale BBW." />;
}
