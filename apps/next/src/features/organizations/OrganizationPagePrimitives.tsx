import type { ReactNode } from 'react';

import PlatformIcon, { type PlatformIconName } from '../dashboard/PlatformIcon';

import styles from './OrganizationPagePrimitives.module.css';
import type { StatusTone } from './organizationPresentation';

export function OrganizationPageShell({ children }: Readonly<{ children: ReactNode }>) {
  return <section className={styles.page}>{children}</section>;
}

export function OrganizationPageHeader({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  const titleId = `${title.toLocaleLowerCase('it').replaceAll(/[^a-z0-9]+/g, '-')}-page-title`;

  return (
    <header className={styles.pageHeader} aria-labelledby={titleId}>
      <p className={styles.eyebrow}>Area organizzativa</p>
      <h1 id={titleId}>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

export function OrganizationSectionHeader({
  title,
  count,
  action,
  id,
}: Readonly<{ title: string; count?: number; action?: ReactNode; id?: string }>) {
  return (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionTitle}>
        <h2 id={id}>{title}</h2>
        {typeof count === 'number' ? <span aria-label={`${count} elementi`}>{count}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({
  label,
  tone,
}: Readonly<{ label: string; tone: StatusTone }>) {
  return <span className={styles.statusBadge} data-tone={tone}>{label}</span>;
}

export function OrganizationEmptyState({
  icon,
  title,
  description,
  action,
}: Readonly<{
  icon: PlatformIconName;
  title: string;
  description: string;
  action?: ReactNode;
}>) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}><PlatformIcon name={icon} size={20} /></span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {action ? <div className={styles.emptyAction}>{action}</div> : null}
      </div>
    </div>
  );
}

export function OrganizationLoadingState({ label }: Readonly<{ label: string }>) {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite">
      <span className={styles.loadingLine} />
      <span className={styles.loadingLine} />
      <span className={styles.loadingLabel}>{label}</span>
    </div>
  );
}
