import PlatformPlaceholder from "../../../features/dashboard/PlatformPlaceholder";
import { requirePlatformContext } from "../../../features/dashboard/requirePlatformContext";

export default async function SettingsPage() {
  const context = await requirePlatformContext();
  return <PlatformPlaceholder user={context.user} profile={context.profile} organizationContext={context} activePath="/impostazioni" eyebrow="Account" title="Impostazioni" description="Le preferenze del tuo spazio BBW saranno configurabili da qui." />;
}
