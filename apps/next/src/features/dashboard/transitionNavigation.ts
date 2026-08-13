import type { OperationalContext, PermissionCode } from '../../types/authorization';
import type { PlatformIconName } from './PlatformIcon';

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: PlatformIconName;
};

const commonAccountItems: DashboardNavItem[] = [
  { href: '/profilo', label: 'Profilo personale', icon: 'profile' },
  { href: '/impostazioni', label: 'Impostazioni', icon: 'settings' },
];

const personalProfessionalItems: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/calendario', label: 'Agenda', icon: 'calendar' },
  { href: '/clienti', label: 'Clienti', icon: 'clients' },
  { href: '/catalogo', label: 'Catalogo', icon: 'catalog' },
  { href: '/disponibilita', label: 'Disponibilità', icon: 'availability' },
  { href: '/consensi', label: 'Consensi', icon: 'consents' },
];

const organizationItems: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/calendario', label: 'Agenda', icon: 'calendar' },
  { href: '/clienti', label: 'Clienti', icon: 'clients' },
  { href: '/catalogo', label: 'Catalogo', icon: 'catalog' },
  { href: '/disponibilita', label: 'Disponibilità', icon: 'availability' },
  { href: '/consensi', label: 'Consensi', icon: 'consents' },
];

function includesAnyPermission(permissions: readonly PermissionCode[], required: readonly PermissionCode[]): boolean {
  return required.some((permission) => permissions.includes(permission));
}

export function getDashboardNavItems(
  context: OperationalContext | null,
  permissions: readonly PermissionCode[],
): DashboardNavItem[] {
  if (!context) return [{ href: '/dashboard', label: 'Dashboard', icon: 'home' }, ...commonAccountItems];

  if (context.kind === 'personal_professional') {
    const visibleItems = permissions.includes('catalog.read')
      ? personalProfessionalItems
      : personalProfessionalItems.filter((item) => item.href !== '/catalogo');
    const patientsVisible = permissions.includes('patients.read')
      ? visibleItems
      : visibleItems.filter((item) => item.href !== '/clienti');
    return [...patientsVisible, ...commonAccountItems];
  }

  const membershipItems: DashboardNavItem[] = [];
  if (includesAnyPermission(permissions, ['organization.members.read', 'organization.members.manage'])) {
    membershipItems.push({ href: '/staff', label: 'Staff', icon: 'staff' });
  }
  if (includesAnyPermission(permissions, ['organization.members.invite', 'organization.members.manage'])) {
    membershipItems.push({ href: '/inviti', label: 'Inviti', icon: 'invites' });
  }

  const visibleOrganizationItems = permissions.includes('catalog.read')
    ? organizationItems
    : organizationItems.filter((item) => item.href !== '/catalogo');
  const patientsVisibleOrganizationItems = permissions.includes('patients.read')
    ? visibleOrganizationItems
    : visibleOrganizationItems.filter((item) => item.href !== '/clienti');
  return [...patientsVisibleOrganizationItems, ...membershipItems, ...commonAccountItems];
}
