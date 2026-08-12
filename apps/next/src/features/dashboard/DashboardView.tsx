import type { OperationalReadiness } from "@bbw/interfaces";

import type { CurrentUser, OrganizationContextSummary, PermissionCode, ProfileSummary } from "../../types/authorization";
import PlatformShell from "./PlatformShell";
import styles from "./Dashboard.module.css";
import DashboardMetricCard from "./DashboardMetricCard";
import DashboardOnboardingBanner from "./DashboardOnboardingBanner";
import OrganizationSummary from "./OrganizationSummary";
import AttentionList from "./AttentionList";
import TodaySchedule from "./TodaySchedule";

type DashboardViewProps = {
  user: CurrentUser;
  profile: ProfileSummary;
  organizationContext: OrganizationContextSummary;
  permissions: PermissionCode[];
  readiness: OperationalReadiness;
};

const dashboardMetrics = [
  {
    icon: "appointments",
    label: "Appuntamenti questa settimana",
    secondaryLabel: "Riepilogo settimanale",
    emptyMessage: "Dati appuntamenti della settimana non ancora disponibili.",
  },
  {
    icon: "bookings",
    label: "Prenotazioni da confermare",
    secondaryLabel: "Richiedono attenzione",
    emptyMessage: "Dati prenotazioni non ancora disponibili.",
  },
  {
    icon: "consents",
    label: "Consensi in attesa",
    secondaryLabel: "Da gestire",
    emptyMessage: "Dati consensi non ancora disponibili.",
  },
  {
    icon: "professionals",
    label: "Team attivo",
    secondaryLabel: "Professionisti attivi",
    emptyMessage: "Dati team non ancora disponibili.",
  },
] as const;

export default function DashboardView({
  user,
  profile,
  organizationContext,
  permissions,
  readiness,
}: DashboardViewProps) {
  const activeOrganization = organizationContext.activeOrganization;
  const organizationName = activeOrganization?.organizationDisplayName ?? "Nessuna organizzazione attiva";

  return (
    <PlatformShell user={user} profile={profile} activePath="/dashboard" organizationContext={organizationContext} permissions={permissions}>
      <section className={styles.dashboardPage} aria-labelledby="dashboard-title">
        <div className={styles.dashboardIntro}>
          <div>
            <p className={styles.eyebrow}>Area organizzativa</p>
            <h1 id="dashboard-title" className={styles.organizationHeroTitle}>{organizationName}</h1>
            <p className={styles.organizationHeroSubtitle}>Dashboard operativa</p>
          </div>
        </div>

        <DashboardOnboardingBanner permissions={permissions} readiness={readiness} />

        <div className={styles.dashboardGrid}>
          <OrganizationSummary
            organization={activeOrganization}
            canManage={permissions.includes("organization.update")}
          />
          <AttentionList />
        </div>

        <TodaySchedule />

        <section className={styles.metricsSection} aria-labelledby="metrics-title">
          <div className={styles.sectionHeaderCompact}>
            <p className={styles.eyebrow} id="metrics-title">Indicatori operativi</p>
          </div>
          <div className={styles.metricsGrid}>
            {dashboardMetrics.map((metric) => (
              <DashboardMetricCard key={metric.label} {...metric} />
            ))}
          </div>
        </section>
      </section>
    </PlatformShell>
  );
}
