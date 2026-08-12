import type { PermissionCode } from "../../types/authorization";
import type { PlatformIconName } from "./PlatformIcon";

export type DashboardQuickAction = {
  href: string;
  label: string;
  icon: PlatformIconName;
  permission: PermissionCode;
};

/**
 * Le azioni operative vengono aggiunte solo quando esiste una destinazione
 * applicativa reale e il contesto autorizzativo espone il relativo permesso.
 * TODO(dashboard-read-model): collegare appuntamenti, inviti, servizi e agenda
 * ai rispettivi contratti prima di aggiungerli a questa configurazione.
 */
const quickActionConfiguration: DashboardQuickAction[] = [
  {
    href: "/organizzazione",
    label: "Gestisci struttura",
    icon: "organization",
    permission: "organization.update",
  },
];

export function getDashboardQuickActions(
  permissions: readonly PermissionCode[],
  hasActiveOrganization: boolean,
): DashboardQuickAction[] {
  if (!hasActiveOrganization) return [];
  return quickActionConfiguration.filter((action) => permissions.includes(action.permission));
}
