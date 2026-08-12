import type { MembershipRole } from "../../types/authorization";

const explicitRoleLabels: Record<string, string> = {
  organization_owner: "Responsabile organizzazione",
  organization_admin: "Amministratore struttura",
  owner: "Responsabile organizzazione",
  admin: "Amministratore struttura",
};

function normalizeRoleValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function getMembershipRoleLabel(role: MembershipRole): string {
  const displayName = normalizeRoleValue(role.displayName);
  const code = normalizeRoleValue(role.code);
  const explicitLabel = explicitRoleLabels[displayName] ?? explicitRoleLabels[code];

  if (explicitLabel) return explicitLabel;
  if (displayName.includes("owner") || code.includes("owner")) return "Responsabile organizzazione";
  if (displayName.includes("admin") || code.includes("admin")) return "Amministratore struttura";

  return role.displayName;
}
