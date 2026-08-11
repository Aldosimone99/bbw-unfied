const accountTypeLabels: Record<string, string> = {
  personal: "Paziente",
  healthcare_professional: "Professionista sanitario",
  beauty_professional: "Professionista beauty",
  organization: "Organizzazione",
  commercial: "Commerciale",
  commercial_partner: "Commerciale"
};

export function getRequestedAccountTypeLabel(accountType: string | null): string {
  return accountTypeLabels[accountType ?? "personal"] ?? "Non selezionato";
}
