import { forbidden } from 'next/navigation';

import PatientDetail from '../../../../features/patients/PatientDetail';
import PlatformShell from '../../../../features/dashboard/PlatformShell';
import { requirePlatformContext } from '../../../../features/dashboard/requirePlatformContext';

type PatientDetailPageProps = { params: Promise<{ id: string }> };

export default async function PatientDetailPage({ params }: PatientDetailPageProps) {
  const context = await requirePlatformContext(true);
  if (!context.operationalPermissions.includes('patients.read')) forbidden();
  const { id } = await params;

  return (
    <PlatformShell
      user={context.user}
      profile={context.profile}
      activePath="/clienti"
      operationalContext={context}
      permissions={context.permissions}
    >
      <PatientDetail relationshipId={id} />
    </PlatformShell>
  );
}
