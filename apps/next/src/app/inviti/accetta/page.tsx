import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import AcceptOrganizationInvitation from '../../../features/organization-invitations/AcceptOrganizationInvitation';
import { getPostLoginContext } from '../../../server/services/post-login-service';

export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

type AcceptInvitationPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function AcceptInvitationPage({ searchParams }: AcceptInvitationPageProps) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  const context = await getPostLoginContext();

  if (!context.user) {
    redirect(`/accedi?${new URLSearchParams({ invitationToken: token }).toString()}`);
  }

  return <AcceptOrganizationInvitation token={token} />;
}
