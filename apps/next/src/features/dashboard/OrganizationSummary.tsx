import { ArrowRight } from "lucide-react";

import type { MembershipSummary } from "../../types/authorization";
import PlatformIcon from "./PlatformIcon";
import styles from "./Dashboard.module.css";

type OrganizationSummaryProps = {
  organization: MembershipSummary | null;
  canManage: boolean;
};

export default function OrganizationSummary({ organization, canManage }: OrganizationSummaryProps) {
  if (!organization) {
    return (
      <section className={`${styles.surfaceCard} ${styles.organizationSummary}`} aria-labelledby="organization-card-title">
        <span className={styles.cardMark}>
          <PlatformIcon name="organization" size={20} />
        </span>
        <p className={styles.cardLabel}>La tua struttura</p>
        <h2 id="organization-card-title">Nessuna organizzazione attiva</h2>
        <p className={styles.cardDescription}>Seleziona un contesto organizzativo per vedere le attività della struttura.</p>
      </section>
    );
  }

  const status = organization.organizationStatus === "active" ? "Struttura attiva" : "Stato struttura non disponibile";

  return (
    <section className={`${styles.surfaceCard} ${styles.organizationSummary}`} aria-labelledby="organization-card-title">
      <span className={styles.cardMark}>
        <PlatformIcon name="organization" size={20} />
      </span>
      <p className={styles.cardLabel}>La tua struttura</p>
      <h2 id="organization-card-title">{organization.organizationDisplayName ?? "Organizzazione senza nome"}</h2>
      <div className={styles.organizationMeta}>
        <span>{organization.organizationTypeDisplayName ?? "Organizzazione"}</span>
        <span>{status}</span>
      </div>
      {canManage ? (
        <a className={styles.textLink} href="/organizzazione">
          Gestisci struttura
          <ArrowRight className={styles.textLinkArrow} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
        </a>
      ) : null}
    </section>
  );
}
