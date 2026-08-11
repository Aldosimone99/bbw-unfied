export type CatalogRole = 'medico_chirurgo' | 'medico_estetico' | 'odontoiatra' | 'dietologo' | 'estetista';

type CatalogUser = {
  tipo_utente?: string | null;
  specializzazioni?: string[] | null;
};

const ALL_ROLES: CatalogRole[] = ['medico_chirurgo', 'medico_estetico', 'odontoiatra', 'dietologo', 'estetista'];

const SPECIALIZZAZIONE_MAP: Array<{ keywords: string[]; role: CatalogRole }> = [
  { keywords: ['chirurgia-plastica', 'chirurgo-plastico'], role: 'medico_chirurgo' },
  { keywords: ['medicina-estetica', 'medico-estetico'], role: 'medico_estetico' },
  { keywords: ['odontoiatria', 'odontoiatra', 'dentista'], role: 'odontoiatra' },
  { keywords: ['nutrizionista', 'dietologo', 'dietologia'], role: 'dietologo' },
];

export function resolveCatalogRoles(user: CatalogUser | null): CatalogRole[] {
  if (!user) return [];
  if (user.tipo_utente === 'admin' || user.tipo_utente === 'clinica') return ALL_ROLES;
  if (user.tipo_utente === 'estetista') return ['estetista'];
  if (user.tipo_utente !== 'medico') return [];

  const specs = user.specializzazioni ?? [];
  const roles = new Set<CatalogRole>();
  for (const spec of specs) {
    const normalized = spec.toLowerCase();
    for (const item of SPECIALIZZAZIONE_MAP) {
      if (item.keywords.some((keyword) => normalized.includes(keyword))) roles.add(item.role);
    }
  }
  if (roles.size === 0) roles.add('medico_estetico');
  return Array.from(roles);
}

export function isTreatmentAllowedForUser(allowedRoles: string[] | null, user: CatalogUser | null): boolean {
  if (allowedRoles === null) return true;
  if (allowedRoles.length === 0) return false;
  const roles = resolveCatalogRoles(user);
  return allowedRoles.some((role) => roles.includes(role as CatalogRole));
}
