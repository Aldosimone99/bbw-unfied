import ProfileView from '../../../features/profile/ProfileView';
import { requirePlatformContext } from '../../../features/dashboard/requirePlatformContext';

export default async function ProfilePage() {
  const context = await requirePlatformContext();
  return (
    <ProfileView
      user={context.user}
      profile={context.profile}
      organizationContext={context}
      readiness={context.readiness!}
    />
  );
}
