import type { ReactNode } from 'react';
import Link from 'next/link';

import { logoutAction } from '../auth/actions';
import type { CurrentUser, OperationalContextSummary, PermissionCode, ProfileSummary } from '../../types/authorization';
import WorkspaceSwitcher from '../operational-context/WorkspaceSwitcher';
import { getOperationalContextUserRoleLabel } from '../operational-context/labels';
import PlatformIcon, { type PlatformIconName } from './PlatformIcon';
import { getDashboardNavItems, isDashboardNavItemActive } from './transitionNavigation';
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
        {items.map((item) => {
          const isActive = isDashboardNavItemActive(activePath, item);
          return (
            <a
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              href={item.href}
              key={item.href}
              aria-current={isActive ? 'page' : undefined}
            >
              <PlatformIcon name={item.icon} className={styles.navIcon} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

type DashboardNavItem = { href: string; label: string; icon: PlatformIconName };

export default function PlatformShell({ user, profile, activePath, operationalContext, permissions, children }: PlatformShellProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Profilo BBW';
  const activeContext = operationalContext.activeOperationalContext;
  const navItems = getDashboardNavItems(activeContext, permissions);
  const accountDescriptor = activeContext
    ? getOperationalContextUserRoleLabel(activeContext) ?? 'Profilo personale'
    : 'Profilo personale';
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
          <div className={styles.sidebarBlock}>
            <WorkspaceSwitcher
              contexts={operationalContext.availableOperationalContexts}
              activeContext={activeContext}
              canManageOrganization={canManageOrganization}
            />
          </div>

          <div className={styles.sidebarBlock}>
            <details className={styles.sidebarUser}>
              <summary className={styles.sidebarUserSummary}>
                <span className={styles.sidebarUserLabel}>Account</span>
                <span className={styles.avatarSmall} aria-hidden="true">{initials}</span>
                <span className={styles.sidebarUserName}>
                  <strong>{fullName}</strong>
                  <span>{accountDescriptor}</span>
                </span>
                <PlatformIcon name="chevronDown" className={styles.userArrow} size={18} />
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
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.mobileNav}>
          {mobileNavItems.map((item) => {
            const isActive = isDashboardNavItemActive(activePath, item);
            return (
              <a
                className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}
                href={item.href}
                key={item.href}
                aria-current={isActive ? 'page' : undefined}
              >
                <PlatformIcon name={item.icon} className={styles.navIcon} />
                {item.label}
              </a>
            );
          })}
        </div>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
