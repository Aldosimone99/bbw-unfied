import type { OperationalReadiness } from "@bbw/interfaces";

import type { PermissionCode } from "../../types/authorization";
import {
  getReadinessLabel,
  organizationProfileFieldLabels,
  personalProfileFieldLabels,
  professionalBlockerLabels,
} from "../authorization/readinessLabels";
import styles from "./Dashboard.module.css";

type DashboardOnboardingBannerProps = {
  permissions: PermissionCode[];
  readiness: OperationalReadiness;
};

export function hasIncompleteReadiness(readiness: OperationalReadiness): boolean {
  return !readiness.personal_profile.complete
    || (readiness.organization.applicable && !readiness.organization.complete)
    || (readiness.professional.applicable && !readiness.professional.operational);
}

export default function DashboardOnboardingBanner({
  permissions,
  readiness,
}: DashboardOnboardingBannerProps) {
  if (!hasIncompleteReadiness(readiness)) return null;

  return (
    <section className={styles.readinessBanner} aria-labelledby="readiness-title">
      <div>
        <p className={styles.eyebrow}>Configurazione</p>
        <h2 id="readiness-title">Completa le attività necessarie</h2>
        <p>
          Alcune funzioni operative saranno disponibili quando i dati richiesti saranno completi.
        </p>
      </div>
      <div className={styles.readinessItems}>
        {!readiness.personal_profile.complete ? (
          <div>
            <strong>Profilo personale</strong>
            <span>{readiness.personal_profile.missing_fields.map((field) => getReadinessLabel(field, personalProfileFieldLabels)).join(", ")}</span>
            <a href="/profilo">Completa profilo</a>
          </div>
        ) : null}
        {readiness.organization.applicable && !readiness.organization.complete ? (
          <div>
            <strong>Profilo struttura</strong>
            <span>{readiness.organization.missing_fields.map((field) => getReadinessLabel(field, organizationProfileFieldLabels)).join(", ")}</span>
            {permissions.includes("organization.update") ? <a href="/organizzazione">Completa struttura</a> : null}
          </div>
        ) : null}
        {readiness.professional.applicable && !readiness.professional.operational ? (
          <div>
            <strong>Verifica professionale</strong>
            <span>{readiness.professional.blockers.map((blocker) => getReadinessLabel(blocker, professionalBlockerLabels)).join(", ")}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
