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

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

export function isRegisterableRole(value: unknown): value is RegisterableRole {
  return isAppRole(value) && value !== 'admin';
}
