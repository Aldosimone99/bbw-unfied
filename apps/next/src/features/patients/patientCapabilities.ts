import type { PermissionCode, OperationalContext } from '../../types/authorization';

export function canInvitePatients(
  context: OperationalContext | null,
  permissions: readonly PermissionCode[],
): boolean {
  return context?.kind === 'organization' && permissions.includes('patients.invite');
}
