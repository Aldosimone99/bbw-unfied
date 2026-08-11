import type { CurrentUser, OrganizationContextSummary, ProfileSummary } from "../../types/authorization";
import PlatformIcon, { type PlatformIconName } from "./PlatformIcon";
import PlatformShell from "./PlatformShell";
import styles from "./Dashboard.module.css";

type PlatformPlaceholderProps = {
  user: CurrentUser;
  profile: ProfileSummary;
  activePath: string;
  eyebrow: string;
  title: string;
  description: string;
  organizationContext: OrganizationContextSummary;
};

export default function PlatformPlaceholder({
  user,
  profile,
  activePath,
  eyebrow,
  title,
  description,
  organizationContext
}: PlatformPlaceholderProps) {
  const iconByPath: Record<string, PlatformIconName> = {
    "/catalogo": "catalog",
    "/calendario": "calendar",
    "/clienti": "clients",
    "/consensi": "consents",
    "/disponibilita": "availability",
    "/inviti": "invites",
    "/membri": "members",
    "/messaggi": "messages",
    "/prenotazioni": "bookings",
    "/profilo": "profile",
    "/report": "reports",
    "/staff": "staff",
    "/storico": "history",
    "/impostazioni": "settings"
  };

  return (
    <PlatformShell user={user} profile={profile} activePath={activePath} organizationContext={organizationContext}>
      <section className={styles.placeholderPage} aria-labelledby="placeholder-title">
        <div className={styles.placeholderIntro}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id="placeholder-title">{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.placeholderCard}>
          <span className={styles.placeholderIcon}>
            <PlatformIcon name={iconByPath[activePath] ?? "home"} size={20} />
          </span>
          <div>
            <p className={styles.cardLabel}>Backend di transizione collegato</p>
            <h2>Sezione pronta per i dati operativi BBW.</h2>
            <p>Il menu e il contesto autorizzativo sono già integrati; qui verranno visualizzate le funzioni operative del backend.</p>
          </div>
        </div>
      </section>
    </PlatformShell>
  );
}
