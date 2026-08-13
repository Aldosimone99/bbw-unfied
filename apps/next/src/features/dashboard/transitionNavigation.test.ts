import { describe, expect, it } from 'vitest';

import type { OperationalContext, PermissionCode } from '../../types/authorization';
import { getDashboardNavItems, isDashboardNavItemActive } from './transitionNavigation';

const organizationContext: OperationalContext = {
  kind: 'organization',
  organizationId: '00000000-0000-4000-8000-000000000001',
  membershipId: '00000000-0000-4000-8000-000000000002',
  label: 'Clinica Aurora',
  organizationTypeCode: 'clinic',
  organizationTypeDisplayName: 'Clinica',
  roles: [],
};

const personalContext: OperationalContext = {
  kind: 'personal_professional',
  professionalProfileId: '00000000-0000-4000-8000-000000000003',
  label: 'Studio personale',
  professionalTypeCode: 'physician',
  professionalTypeDisplayName: 'Medico',
};

function labelsAndHrefs(permissions: PermissionCode[], context: OperationalContext) {
  return getDashboardNavItems(context, permissions).map((item) => ({ label: item.label, href: item.href }));
}

describe('dashboard patient navigation', () => {
  it('shows Pazienti for an organization with patients.read in the requested order', () => {
    expect(labelsAndHrefs(['patients.read', 'catalog.read'], organizationContext)).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Agenda', href: '/calendario' },
      { label: 'Pazienti', href: '/pazienti' },
      { label: 'Catalogo', href: '/catalogo' },
      { label: 'Disponibilità', href: '/disponibilita' },
      { label: 'Consensi', href: '/consensi' },
      { label: 'Profilo personale', href: '/profilo' },
      { label: 'Impostazioni', href: '/impostazioni' },
    ]);
  });

  it('hides Pazienti from an organization without patients.read', () => {
    expect(labelsAndHrefs(['catalog.read'], organizationContext).some((item) => item.href === '/pazienti')).toBe(false);
  });

  it('keeps personal-professional patient navigation permission-based', () => {
    expect(labelsAndHrefs(['patients.read'], personalContext).some((item) => item.href === '/pazienti')).toBe(true);
    expect(labelsAndHrefs([], personalContext).some((item) => item.href === '/pazienti')).toBe(false);
  });

  it('marks only the canonical /pazienti path as active', () => {
    const item = getDashboardNavItems(organizationContext, ['patients.read']).find((entry) => entry.href === '/pazienti');
    expect(item).toBeDefined();
    expect(isDashboardNavItemActive('/pazienti', item!)).toBe(true);
    expect(isDashboardNavItemActive('/clienti', item!)).toBe(false);
  });
});
