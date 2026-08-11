import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

import type { CurrentUser, OrganizationContextSummary, PermissionCode, ProfileSummary } from "../../types/authorization";
import PlatformShell from "./PlatformShell";
import PlatformIcon, { type PlatformIconName } from "./PlatformIcon";
import { getDashboardNavItems } from "./transitionNavigation";
import { getRequestedAccountTypeLabel } from "./profileLabels";
import styles from "./Dashboard.module.css";

type DashboardViewProps = {
  user: CurrentUser;
  profile: ProfileSummary;
  organizationContext: OrganizationContextSummary;
  permissions: PermissionCode[];
};

function QuickActionIcon({ name }: { name: PlatformIconName }) {
  return <PlatformIcon name={name} className={styles.quickActionGlyph} />;
}

function getGreeting() {
  const hour = Number(new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Rome"
  }).format(new Date()));

  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export default function DashboardView({ user, profile, organizationContext, permissions }: DashboardViewProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Profilo BBW";
  const firstName = profile.firstName || fullName;
  const greeting = getGreeting();
  const accountTypeLabel = getRequestedAccountTypeLabel(profile.requestedAccountType);

  const quickActions: Array<{ href: string; label: string; icon: PlatformIconName }> = getDashboardNavItems(profile)
    .filter((item) => !["/dashboard", "/profilo", "/impostazioni"].includes(item.href))
    .slice(0, 4);

  return (
    <PlatformShell user={user} profile={profile} activePath="/dashboard" organizationContext={organizationContext}>
      <section className={styles.dashboardPage} aria-labelledby="dashboard-title">
        <div className={styles.dashboardIntro}>
          <div>
            <p className={styles.eyebrow}>Area personale</p>
            <h1 id="dashboard-title">{greeting}, {firstName}.</h1>
            <p>Bentornato nel tuo spazio personale.</p>
          </div>
        </div>

        <section className={styles.quickActions} aria-label="Azioni rapide">
          <div className={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <a className={styles.quickAction} href={action.href} key={action.href}>
                <QuickActionIcon name={action.icon} />
                <span>{action.label}</span>
                <ArrowRight className={styles.quickActionArrow} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
              </a>
            ))}
          </div>
        </section>

        <div className={styles.dashboardGrid}>
          <section className={`${styles.surfaceCard} ${styles.profileCard}`} aria-labelledby="profile-card-title">
            <span className={styles.cardMark}>
              <PlatformIcon name="profile" size={20} className={styles.cardIcon} />
            </span>
            <p className={styles.cardLabel}>Il tuo profilo</p>
            <h2 id="profile-card-title">{fullName}</h2>
            <p className={styles.profileMeta}>{accountTypeLabel}</p>
            <a className={styles.textLink} href="/profilo">Visualizza profilo <ArrowRight className={styles.textLinkArrow} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /></a>
          </section>

          <section className={styles.surfaceCard} aria-labelledby="calendar-card-title">
            <span className={styles.cardMark}>
              <PlatformIcon name="calendar" size={20} className={styles.cardIcon} />
            </span>
              <p className={styles.cardLabel}>Calendario</p>
            <div className={styles.metricBlock} style={{ display: "block", marginTop: 15 }}>
              <strong
                className={styles.metricValue}
                id="calendar-card-title"
                style={{ display: "block", color: "#332720", fontSize: "clamp(2.35rem, 3.2vw, 3.45rem)", fontWeight: 300, lineHeight: 1, letterSpacing: "-.04em" }}
              >0</strong>
              <br className={styles.metricFallbackBreak} style={{ display: "none" }} />
              <span
                className={styles.metricLabel}
                style={{ display: "block", marginTop: 7, color: "#4c3b30", fontSize: ".82rem", lineHeight: 1.25 }}
              >Eventi programmati</span>
            </div>
            <p className={styles.cardDescription}>Non ci sono eventi in programma.</p>
            <a className={styles.textLink} href="/calendario">Apri calendario <ArrowRight className={styles.textLinkArrow} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /></a>
          </section>

          <section className={styles.surfaceCard} aria-labelledby="booking-card-title">
            <span className={styles.cardMark}>
              <PlatformIcon name="bookings" size={20} className={styles.cardIcon} />
            </span>
              <p className={styles.cardLabel}>Prenotazioni</p>
            <div className={styles.metricBlock} style={{ display: "block", marginTop: 15 }}>
              <strong
                className={styles.metricValue}
                id="booking-card-title"
                style={{ display: "block", color: "#332720", fontSize: "clamp(2.35rem, 3.2vw, 3.45rem)", fontWeight: 300, lineHeight: 1, letterSpacing: "-.04em" }}
              >0</strong>
              <br className={styles.metricFallbackBreak} style={{ display: "none" }} />
              <span
                className={styles.metricLabel}
                style={{ display: "block", marginTop: 7, color: "#4c3b30", fontSize: ".82rem", lineHeight: 1.25 }}
              >Prenotazioni attive</span>
            </div>
            <p className={styles.cardDescription}>Non hai prenotazioni attive.</p>
            <a className={styles.textLink} href="/prenotazioni">Vai alle prenotazioni <ArrowRight className={styles.textLinkArrow} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /></a>
          </section>
        </div>

        <section className={styles.accountSummary} aria-labelledby="account-summary-title">
          <div className={styles.summaryIntro}>
            <p className={styles.eyebrow}>Riepilogo account</p>
            <h2 id="account-summary-title">Stato del tuo account</h2>
          </div>
          <ul className={styles.checklist}>
            <li className={styles.checklistDone}><CheckCircle2 className={styles.checkMark} size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" /><span>Email associata</span><strong>Completata</strong></li>
            <li><Circle className={styles.checkMark} size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" /><span>Nessuna prenotazione</span><strong>In attesa</strong></li>
            <li><Circle className={styles.checkMark} size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" /><span>Calendario vuoto</span><strong>In attesa</strong></li>
          </ul>
        </section>

        <section className={styles.contextSummary} aria-labelledby="context-summary-title">
          <div className={styles.summaryIntro}>
            <p className={styles.eyebrow}>Verifica tecnica</p>
            <h2 id="context-summary-title">Contesto autorizzativo</h2>
          </div>
          <dl className={styles.contextDetails}>
            <div>
              <dt>Email</dt>
              <dd>{user.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Organizzazione attiva</dt>
              <dd>{organizationContext.activeOrganization?.organizationDisplayName ?? "Nessuna"}</dd>
            </div>
            <div>
              <dt>ID organizzazione</dt>
              <dd>{organizationContext.activeOrganization?.organizationId ?? "—"}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{organizationContext.activeOrganization?.organizationTypeDisplayName ?? "—"}</dd>
            </div>
            <div>
              <dt>Membership</dt>
              <dd>{organizationContext.activeOrganization?.status ?? "—"} · {organizationContext.activeOrganization?.id ?? "—"}</dd>
            </div>
            <div>
              <dt>Ruoli attivi</dt>
              <dd>{organizationContext.activeOrganization?.roles.map((role) => role.displayName).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Organizzazioni disponibili</dt>
              <dd>{organizationContext.memberships.filter((membership) => membership.status === "active" && membership.organizationStatus === "active").map((membership) => membership.organizationDisplayName ?? membership.organizationId).join(", ") || "Nessuna"}</dd>
            </div>
            <div>
              <dt>Permessi nel contesto</dt>
              <dd>{permissions.join(", ") || "Nessuno"}</dd>
            </div>
          </dl>
        </section>

      </section>
    </PlatformShell>
  );
}
