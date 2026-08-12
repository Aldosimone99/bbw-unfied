import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

import { logoutAction } from '../auth/actions';
import ContextSwitcher from '../operational-context/ContextSwitcher';
import { getOperationalContextTypeLabel } from '../operational-context/labels';
import type { CurrentUser, OperationalContextSummary, PermissionCode, ProfileSummary } from '../../types/authorization';
import PlatformIcon, { type PlatformIconName } from './PlatformIcon';
import { getDashboardNavItems } from './transitionNavigation';
import styles from './Dashboard.module.css';

type PlatformShellProps = {
  user: CurrentUser;
  profile: ProfileSummary;
  activePath: string;
  operationalContext: OperationalContextSummary;
  permissions: PermissionCode[];
  children: ReactNode;
};

function NavigationGroup({ label, items, activePath }: { label: string; items: DashboardNavItem[]; activePath: string }) {
  return (
    <div className={styles.navGroup}>
      <p className={styles.navLabel}>{label}</p>
      <nav aria-label={label} className={styles.navList}>
        {items.map((item) => (
          <a
            className={`${styles.navItem} ${activePath === item.href ? styles.navItemActive : ''}`}
            href={item.href}
            key={item.href}
            aria-current={activePath === item.href ? 'page' : undefined}
          >
            <PlatformIcon name={item.icon} className={styles.navIcon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

type DashboardNavItem = { href: string; label: string; icon: PlatformIconName };

export default function PlatformShell({ user, profile, activePath, operationalContext, permissions, children }: PlatformShellProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Profilo BBW';
  const activeContext = operationalContext.activeOperationalContext;
  const contextLabel = activeContext ? getOperationalContextTypeLabel(activeContext) : 'Setup account';
  const navItems = getDashboardNavItems(activeContext, permissions);
  const accountItems = navItems.filter((item) => item.href === '/profilo' || item.href === '/impostazioni');
  const canManageOrganization = activeContext?.kind === 'organization' && permissions.includes('organization.update');
  const organizationProfileItem: DashboardNavItem = {
    href: '/organizzazione',
    label: 'Profilo struttura',
    icon: 'organization',
  };
  if (canManageOrganization) accountItems.push(organizationProfileItem);
  const experienceItems = navItems.filter((item) => !accountItems.some((accountItem) => accountItem.href === item.href));
  const mobileNavItems = canManageOrganization ? [...navItems, organizationProfileItem] : navItems;
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'BW';

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar} aria-label="Navigazione area operativa">
        <Link className={styles.brand} href="/" aria-label="Beauty Broker World, home">
          <img src="/images/brand/logo-flat-dark-bronze.png" alt="" />
          <span>Beauty Broker <strong>World</strong></span>
        </Link>

        <div className={styles.sidebarNav}>
          <NavigationGroup label="Esperienza" items={experienceItems} activePath={activePath} />
          <NavigationGroup label="Account" items={accountItems} activePath={activePath} />
        </div>

        <div className={styles.sidebarBottom}>
          <ContextSwitcher
            contexts={operationalContext.availableOperationalContexts}
            activeContext={activeContext}
          />
          <details className={styles.sidebarUser}>
            <summary className={styles.sidebarUserSummary}>
              <span className={styles.avatarSmall} aria-hidden="true">{initials}</span>
              <span className={styles.sidebarUserName}>
                <strong>{fullName}</strong>
                <span>{contextLabel}</span>
              </span>
              <ChevronDown className={styles.userArrow} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
            </summary>
            <div className={styles.sidebarAccountMenu}>
              <a href="/profilo">Profilo personale</a>
              <a href="/impostazioni">Impostazioni</a>
              <form action={logoutAction}>
                <button type="submit">Esci dall’account</button>
              </form>
            </div>
          </details>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.mobileNav}>
          {mobileNavItems.map((item) => (
            <a
              className={`${styles.mobileNavItem} ${activePath === item.href ? styles.mobileNavItemActive : ''}`}
              href={item.href}
              key={item.href}
              aria-current={activePath === item.href ? 'page' : undefined}
            >
              <PlatformIcon name={item.icon} className={styles.navIcon} />
              {item.label}
            </a>
          ))}
        </div>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
