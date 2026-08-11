import type { ProfileSummary } from "../../types/authorization";
import type { PlatformIconName } from "./PlatformIcon";

export type TransitionRole = "cliente" | "medico" | "estetista" | "clinica" | "commerciale";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: PlatformIconName;
};

export function getTransitionRole(profile: ProfileSummary): TransitionRole {
  switch (profile.operationalRole) {
    case "medico":
      return "medico";
    case "estetista":
      return "estetista";
    case "clinica":
      return "clinica";
    case "commerciale":
      return "commerciale";
    case "cliente":
      return "cliente";
    default:
      break;
  }

  // A requested account type never grants the corresponding operational menu.
  if (!profile.operationalRole) return "cliente";
  switch (profile.requestedAccountType) {
    case "healthcare_professional":
      return "medico";
    case "beauty_professional":
      return "estetista";
    case "organization":
      return "clinica";
    case "commercial":
      return "commerciale";
    case "personal":
    default:
      return "cliente";
  }
}

const commonAccountItems: DashboardNavItem[] = [
  { href: "/profilo", label: "Profilo", icon: "profile" },
  { href: "/impostazioni", label: "Impostazioni", icon: "settings" }
];

const navByRole: Record<TransitionRole, DashboardNavItem[]> = {
  cliente: [
    { href: "/dashboard", label: "Dashboard", icon: "home" },
    { href: "/consensi", label: "Consensi", icon: "consents" },
    { href: "/messaggi", label: "Messaggi", icon: "messages" },
    { href: "/inviti", label: "Inviti", icon: "invites" },
    { href: "/prenotazioni", label: "Appuntamenti", icon: "bookings" },
    { href: "/storico", label: "Storico", icon: "history" },
    ...commonAccountItems
  ],
  medico: [
    { href: "/dashboard", label: "Dashboard", icon: "home" },
    { href: "/catalogo", label: "Catalogo", icon: "catalog" },
    { href: "/consensi", label: "Consensi", icon: "consents" },
    { href: "/disponibilita", label: "Disponibilità", icon: "availability" },
    { href: "/messaggi", label: "Messaggi", icon: "messages" },
    { href: "/inviti", label: "Inviti", icon: "invites" },
    { href: "/prenotazioni", label: "Appuntamenti", icon: "bookings" },
    { href: "/clienti", label: "Clienti", icon: "clients" },
    ...commonAccountItems
  ],
  estetista: [
    { href: "/dashboard", label: "Dashboard", icon: "home" },
    { href: "/catalogo", label: "Catalogo", icon: "catalog" },
    { href: "/consensi", label: "Consensi", icon: "consents" },
    { href: "/disponibilita", label: "Disponibilità", icon: "availability" },
    { href: "/messaggi", label: "Messaggi", icon: "messages" },
    { href: "/inviti", label: "Inviti", icon: "invites" },
    { href: "/prenotazioni", label: "Appuntamenti", icon: "bookings" },
    { href: "/clienti", label: "Clienti", icon: "clients" },
    ...commonAccountItems
  ],
  clinica: [
    { href: "/dashboard", label: "Dashboard", icon: "home" },
    { href: "/catalogo", label: "Catalogo", icon: "catalog" },
    { href: "/consensi", label: "Consensi", icon: "consents" },
    { href: "/disponibilita", label: "Disponibilità", icon: "availability" },
    { href: "/messaggi", label: "Messaggi", icon: "messages" },
    { href: "/membri", label: "Membri", icon: "members" },
    { href: "/prenotazioni", label: "Appuntamenti", icon: "bookings" },
    { href: "/clienti", label: "Clienti", icon: "clients" },
    { href: "/staff", label: "Staff", icon: "staff" },
    ...commonAccountItems
  ],
  commerciale: [
    { href: "/dashboard", label: "Dashboard", icon: "home" },
    { href: "/messaggi", label: "Messaggi", icon: "messages" },
    { href: "/inviti", label: "Inviti", icon: "invites" },
    { href: "/clienti", label: "Clienti", icon: "clients" },
    { href: "/report", label: "Report", icon: "reports" },
    ...commonAccountItems
  ]
};

export function getDashboardNavItems(profile: ProfileSummary): DashboardNavItem[] {
  return navByRole[getTransitionRole(profile)];
}
