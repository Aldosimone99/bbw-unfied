import type { OperationalReadiness } from '@bbw/interfaces';

import type { CurrentUser, OrganizationContextSummary, PermissionCode, ProfileSummary } from '../../types/authorization';
import PlatformShell from '../dashboard/PlatformShell';
import { getReadinessLabel, organizationProfileFieldLabels } from '../authorization/readinessLabels';
import type { OrganizationProfile } from '../../server/services/organization-profile-service';
import OrganizationProfileForm from './OrganizationProfileForm';
import styles from './OrganizationProfile.module.css';

type OrganizationProfileViewProps = {
  user: CurrentUser;
  profile: ProfileSummary;
  organizationContext: OrganizationContextSummary;
  permissions: PermissionCode[];
  readiness: OperationalReadiness;
  organization: OrganizationProfile;
};

export default function OrganizationProfileView({
  user,
  profile,
  organizationContext,
  permissions,
  readiness,
  organization,
}: OrganizationProfileViewProps) {
  const complete = readiness.organization.complete;
  const missingFields = readiness.organization.missing_fields;

  return (
    <PlatformShell user={user} profile={profile} activePath="/organizzazione" organizationContext={organizationContext} permissions={permissions}>
      <section className={styles.page} aria-labelledby="organization-profile-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Organizzazione attiva</p>
          <h1 id="organization-profile-title">Profilo organizzazione</h1>
          <p>Completa i dati necessari per le future funzioni operative nel contesto selezionato.</p>
        </div>

        <section className={styles.card} aria-labelledby="organization-data-title">
          <div className={styles.header}>
            <div>
              <p className={styles.label}>Dati legali e contatti</p>
              <h2 id="organization-data-title">{organization.display_name ?? 'Organizzazione'}</h2>
            </div>
            <span className={styles.status} data-complete={complete}>
              {complete ? 'Completa' : `${missingFields.length} mancanti`}
            </span>
          </div>

          {!complete ? (
            <div className={styles.notice}>
              <p>Per questa organizzazione mancano:</p>
              <ul>
                {missingFields.map((field) => <li key={field}>{getReadinessLabel(field, organizationProfileFieldLabels)}</li>)}
              </ul>
            </div>
          ) : null}

          <OrganizationProfileForm organization={organization} />
        </section>
      </section>
    </PlatformShell>
  );
}
