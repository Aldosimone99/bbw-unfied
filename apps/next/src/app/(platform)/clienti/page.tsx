import { forbidden } from 'next/navigation';

import PatientRelationships from '../../../features/patients/PatientRelationships';
import PlatformShell from '../../../features/dashboard/PlatformShell';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function ClientsPage() {
  const context = await requirePlatformContext(true);
  if (!context.operationalPermissions.includes('patients.read')) forbidden();

  return (
    <PlatformShell
      user={context.user}
      profile={context.profile}
      activePath="/clienti"
      operationalContext={context}
      permissions={context.permissions}
    >
      <PatientRelationships
        canLink={context.operationalPermissions.includes('patients.link')}
        canUnlink={context.operationalPermissions.includes('patients.unlink')}
      />
    </PlatformShell>
  );
}
