export const APP_ROLES = [
  'admin',
  'medico',
  'estetista',
  'commerciale',
  'clinica',
  'cliente',
] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type RegisterableRole = Exclude<AppRole, 'admin'>;

// `privato` is the legacy neutral value used while an account has not yet
// completed onboarding. It is not an operational role or a permission grant.
export const PERSISTED_USER_TYPES = [...APP_ROLES, 'privato'] as const;
export type PersistedUserType = (typeof PERSISTED_USER_TYPES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

export function isRegisterableRole(value: unknown): value is RegisterableRole {
  return isAppRole(value) && value !== 'admin';
}
