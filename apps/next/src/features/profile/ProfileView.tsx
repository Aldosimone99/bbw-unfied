import type { OperationalReadiness } from '@bbw/interfaces';

import type { CurrentUser, OperationalContextSummary, PermissionCode, ProfileSummary } from '../../types/authorization';
import { getRequestedAccountTypeLabel } from '../dashboard/profileLabels';
import PlatformShell from '../dashboard/PlatformShell';
import { getReadinessLabel, personalProfileFieldLabels } from '../authorization/readinessLabels';
import ProfileForm from './ProfileForm';
import styles from './Profile.module.css';

type ProfileViewProps = {
  user: CurrentUser;
  profile: ProfileSummary;
  operationalContext: OperationalContextSummary;
  permissions: PermissionCode[];
  readiness: OperationalReadiness;
};

export default function ProfileView({ user, profile, operationalContext, permissions, readiness }: ProfileViewProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Profilo BBW';
  const missingFields = readiness.personal_profile.missing_fields;
  const personalProfileComplete = readiness.personal_profile.complete;

  return (
    <PlatformShell user={user} profile={profile} activePath="/profilo" operationalContext={operationalContext} permissions={permissions}>
      <section className={styles.page} aria-labelledby="profile-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Account</p>
          <h1 id="profile-title">Il tuo profilo</h1>
          <p>Gestisci i dati essenziali del tuo spazio personale.</p>
        </div>
        <div className={styles.layout}>
          <section className={styles.card} aria-labelledby="personal-data-title">
            <div className={styles.cardHeader}>
              <div><p className={styles.cardLabel}>Dati personali</p><h2 id="personal-data-title">Informazioni di base</h2></div>
              <span className={styles.status} data-complete={personalProfileComplete}>{personalProfileComplete ? 'Completo' : `${missingFields.length} mancanti`}</span>
            </div>
            {!personalProfileComplete ? (
              <div className={styles.completionNotice} aria-labelledby="profile-completeness-title">
                <h3 id="profile-completeness-title">Profilo incompleto</h3>
                <p>Completa queste informazioni per usare le future funzioni che richiedono un profilo operativo.</p>
                <ul>{missingFields.map((field) => <li key={field}>{getReadinessLabel(field, personalProfileFieldLabels)}</li>)}</ul>
              </div>
            ) : null}
            <ProfileForm profile={profile} />
          </section>
          <aside className={styles.accountCard} aria-labelledby="account-info-title">
            <p className={styles.cardLabel}>Account</p>
            <h2 id="account-info-title">{fullName}</h2>
            <dl className={styles.details}>
              <div><dt>Email</dt><dd>{user.email ?? 'Non disponibile'}</dd></div>
              <div><dt>Intent iniziale</dt><dd>{getRequestedAccountTypeLabel(profile.requestedAccountType)}</dd></div>
              <div><dt>Stato profilo</dt><dd>{personalProfileComplete ? 'Completo' : `${missingFields.length} informazioni mancanti`}</dd></div>
            </dl>
          </aside>
        </div>
      </section>
    </PlatformShell>
  );
}
