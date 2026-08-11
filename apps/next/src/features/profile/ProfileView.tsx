import type { CurrentUser, OrganizationContextSummary, ProfileSummary } from "../../types/authorization";
import { getRequestedAccountTypeLabel } from "../dashboard/profileLabels";
import PlatformShell from "../dashboard/PlatformShell";
import ProfileForm from "./ProfileForm";
import styles from "./Profile.module.css";

type ProfileViewProps = {
  user: CurrentUser;
  profile: ProfileSummary;
  organizationContext: OrganizationContextSummary;
};

export default function ProfileView({ user, profile, organizationContext }: ProfileViewProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Profilo BBW";

  return (
    <PlatformShell user={user} profile={profile} activePath="/profilo" organizationContext={organizationContext}>
      <section className={styles.page} aria-labelledby="profile-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Account</p>
          <h1 id="profile-title">Il tuo profilo</h1>
          <p>Gestisci i dati essenziali del tuo spazio personale.</p>
        </div>

        <div className={styles.layout}>
          <section className={styles.card} aria-labelledby="personal-data-title">
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardLabel}>Dati personali</p>
                <h2 id="personal-data-title">Informazioni di base</h2>
              </div>
              <span className={styles.status}>In aggiornamento</span>
            </div>
            <ProfileForm profile={profile} />
          </section>

          <aside className={styles.accountCard} aria-labelledby="account-info-title">
            <p className={styles.cardLabel}>Account</p>
            <h2 id="account-info-title">{fullName}</h2>
            <dl className={styles.details}>
              <div>
                <dt>Email</dt>
                <dd>{user.email ?? "Non disponibile"}</dd>
              </div>
              <div>
                <dt>Ruolo</dt>
                <dd>{getRequestedAccountTypeLabel(profile.requestedAccountType)}</dd>
              </div>
              <div>
                <dt>Stato</dt>
                <dd>Profilo in aggiornamento</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    </PlatformShell>
  );
}
