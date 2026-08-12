import type { ReactNode } from 'react';
import type { OperationalReadiness, OperationalRequirement } from '@bbw/interfaces';

import {
  getReadinessLabel,
  organizationProfileFieldLabels,
  personalProfileFieldLabels,
  professionalBlockerLabels,
} from './readinessLabels';
import styles from './OperationalRequirementGuard.module.css';

type OperationalRequirementGuardProps = {
  readiness: OperationalReadiness;
  requirements: OperationalRequirement;
  children: ReactNode;
  completionHref?: string;
};

type RequirementMessage = {
  title: string;
  items: string[];
  href: string;
};

function getRequirementMessage(
  readiness: OperationalReadiness,
  requirements: OperationalRequirement,
  completionHref?: string,
): RequirementMessage | null {
  if (requirements.personal_profile_complete && !readiness.personal_profile.complete) {
    return {
      title: 'Completa il tuo profilo per utilizzare questa funzione.',
      items: readiness.personal_profile.missing_fields.map((field) => getReadinessLabel(field, personalProfileFieldLabels)),
      href: completionHref ?? '/profilo',
    };
  }

  if (requirements.organization_profile_complete && !readiness.organization.complete) {
    return {
      title: 'Completa il profilo dell’organizzazione per utilizzare questa funzione.',
      items: readiness.organization.missing_fields.map((field) => getReadinessLabel(field, organizationProfileFieldLabels)),
      href: completionHref ?? '/organizzazione',
    };
  }

  if ((requirements.professional_profile_complete && !readiness.professional.profile_complete)
    || (requirements.professional_verified && !readiness.professional.operational)) {
    return {
      title: 'Completa o verifica il tuo profilo professionale per utilizzare questa funzione.',
      items: readiness.professional.blockers.map((blocker) => getReadinessLabel(blocker, professionalBlockerLabels)),
      href: completionHref ?? '/profilo',
    };
  }

  return null;
}

export default function OperationalRequirementGuard({
  readiness,
  requirements,
  children,
  completionHref,
}: OperationalRequirementGuardProps) {
  const message = getRequirementMessage(readiness, requirements, completionHref);
  if (!message) return children;

  return (
    <section className={styles.blocked} aria-labelledby="operational-requirement-title">
      <p className={styles.eyebrow}>Configurazione richiesta</p>
      <h2 id="operational-requirement-title">{message.title}</h2>
      {message.items.length > 0 ? (
        <ul>
          {message.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      <a href={message.href}>Completa configurazione</a>
    </section>
  );
}
