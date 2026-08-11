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
    "/calendario": "calendar",
    "/prenotazioni": "bookings",
    "/profilo": "profile",
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
            <p className={styles.cardLabel}>In preparazione</p>
            <h2>Questa sezione sarà configurata prossimamente.</h2>
            <p>La struttura è pronta per accogliere i tuoi dati e le funzioni del gestionale.</p>
          </div>
        </div>
      </section>
    </PlatformShell>
  );
}
