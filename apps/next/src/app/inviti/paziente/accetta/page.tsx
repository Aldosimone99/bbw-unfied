import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import AcceptPatientInvitation from '../../../../features/patient-invitations/AcceptPatientInvitation';
import { getPostLoginContext } from '../../../../server/services/post-login-service';

export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

type AcceptPatientInvitationPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function AcceptPatientInvitationPage({ searchParams }: AcceptPatientInvitationPageProps) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  const tokenQuery = new URLSearchParams({ patientInvitationToken: token }).toString();
  const context = await getPostLoginContext();

  if (!context.user) {
    redirect(`/accedi?${tokenQuery}`);
  }

  if (context.profile?.onboardingStatus !== 'completed') {
    redirect(`/onboarding?${tokenQuery}`);
  }

  return <AcceptPatientInvitation token={token} />;
}
