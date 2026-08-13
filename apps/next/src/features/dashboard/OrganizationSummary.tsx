import type { OperationalContext } from '@bbw/interfaces';
import { ArrowRight } from 'lucide-react';

import { getOperationalContextRoleLabel, getOperationalContextTypeLabel } from '../operational-context/labels';
import PlatformIcon from './PlatformIcon';
import styles from './Dashboard.module.css';

type OrganizationSummaryProps = {
  context: OperationalContext | null;
  canManage: boolean;
};

export default function OrganizationSummary({ context, canManage }: OrganizationSummaryProps) {
  if (!context) {
    return (
      <section className={`${styles.surfaceCard} ${styles.organizationSummary}`} aria-labelledby="context-card-title">
        <span className={styles.cardMark}><PlatformIcon name="organization" size={20} /></span>
        <p className={styles.cardLabel}>Contesto operativo</p>
        <h2 id="context-card-title">Nessun contesto attivo</h2>
        <p className={styles.cardDescription}>Completa il setup oppure scegli uno spazio di lavoro per visualizzare le attività operative.</p>
      </section>
    );
  }

  const roleLabel = getOperationalContextRoleLabel(context);
  const isOrganization = context.kind === 'organization';

  return (
    <section className={`${styles.surfaceCard} ${styles.organizationSummary}`} aria-labelledby="context-card-title">
      <span className={styles.cardMark}><PlatformIcon name={isOrganization ? 'organization' : 'professionals'} size={20} /></span>
      <p className={styles.cardLabel}>{getOperationalContextTypeLabel(context)}</p>
      <h2 id="context-card-title">{context.label}</h2>
      <div className={styles.organizationMeta}>
        {roleLabel ? <span className={styles.organizationRole}>{roleLabel}</span> : null}
        <span className={styles.organizationState}>{isOrganization ? 'Organizzazione attiva' : 'Profilo professionale attivo'}</span>
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
