import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { logoutAction } from "../auth/actions";
import type { CurrentUser, OrganizationContextSummary, ProfileSummary } from "../../types/authorization";
import ContextSwitcher from "../organizations/ContextSwitcher";
import { getRequestedAccountTypeLabel } from "./profileLabels";
import PlatformIcon, { type PlatformIconName } from "./PlatformIcon";
import { getDashboardNavItems } from "./transitionNavigation";
import styles from "./Dashboard.module.css";

type PlatformShellProps = {
  user: CurrentUser;
  profile: ProfileSummary;
  activePath: string;
  organizationContext: OrganizationContextSummary;
  children: ReactNode;
};

function NavigationGroup({ label, items, activePath }: { label: string; items: Array<{ href: string; label: string; icon: PlatformIconName }>; activePath: string }) {
  return (
    <div className={styles.navGroup}>
      <p className={styles.navLabel}>{label}</p>
      <nav aria-label={label} className={styles.navList}>
        {items.map((item) => (
          <a
            className={`${styles.navItem} ${activePath === item.href ? styles.navItemActive : ""}`}
            href={item.href}
            key={item.href}
            aria-current={activePath === item.href ? "page" : undefined}
          >
            <PlatformIcon name={item.icon} className={styles.navIcon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

export default function PlatformShell({ user, profile, activePath, organizationContext, children }: PlatformShellProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Profilo BBW";
  const accountTypeLabel = getRequestedAccountTypeLabel(profile.requestedAccountType);
  const navItems = getDashboardNavItems(profile);
  const accountItems = navItems.filter((item) => item.href === "/profilo" || item.href === "/impostazioni");
  const experienceItems = navItems.filter((item) => !accountItems.includes(item));
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BW";

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar} aria-label="Navigazione area personale">
        <Link className={styles.brand} href="/" aria-label="Beauty Broker World, home">
          <img src="/images/brand/logo-flat-dark-bronze.png" alt="" />
          <span>Beauty Broker <strong>World</strong></span>
        </Link>

        <div className={styles.sidebarNav}>
          <ContextSwitcher {...organizationContext} />
          <NavigationGroup label="Esperienza" items={experienceItems} activePath={activePath} />
          <NavigationGroup label="Account" items={accountItems} activePath={activePath} />
        </div>

        <details className={styles.sidebarUser}>
          <summary className={styles.sidebarUserSummary}>
            <span className={styles.avatarSmall} aria-hidden="true">{initials}</span>
            <span className={styles.sidebarUserName}>
              <strong>{fullName}</strong>
              <span>{accountTypeLabel}</span>
            </span>
            <ChevronDown className={styles.userArrow} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
          </summary>
          <div className={styles.sidebarAccountMenu}>
            <a href="/profilo">Profilo account</a>
            <a href="/impostazioni">Impostazioni</a>
            <form action={logoutAction}>
              <button type="submit">Esci dall’account</button>
            </form>
          </div>
        </details>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.mobileNav}>
          {navItems.map((item) => (
            <a
              className={`${styles.mobileNavItem} ${activePath === item.href ? styles.mobileNavItemActive : ""}`}
              href={item.href}
              key={item.href}
              aria-current={activePath === item.href ? "page" : undefined}
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
