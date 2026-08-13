import { forbidden } from 'next/navigation';

import CatalogManager from '../../../features/catalog/CatalogManager';
import PlatformShell from '../../../features/dashboard/PlatformShell';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function CatalogPage() {
  const context = await requirePlatformContext(true);
  if (!context.operationalPermissions.includes('catalog.read')) forbidden();

  return (
    <PlatformShell
      user={context.user}
      profile={context.profile}
      activePath="/catalogo"
      operationalContext={context}
      permissions={context.permissions}
    >
      <CatalogManager
        canCreate={context.operationalPermissions.includes('catalog.offering.create')}
        canUpdate={context.operationalPermissions.includes('catalog.offering.update')}
        canRemove={context.operationalPermissions.includes('catalog.offering.remove')}
      />
    </PlatformShell>
  );
}
