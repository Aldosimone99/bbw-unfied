import { redirect } from "next/navigation";
import Link from "next/link";

import OnboardingForm from "../../../features/auth/OnboardingForm";
import { logoutAction } from "../../../features/auth/actions";
import { getCurrentProfile } from "../../../server/auth/current-user";
import { resolvePostLoginDestination } from "../../../server/services/post-login-service";
import styles from "../../../components/forms/AuthPage.module.css";

type OnboardingPageProps = {
  searchParams?: Promise<{
    redirectTo?: string | string[];
    invitationToken?: string | string[];
    patientInvitationToken?: string | string[];
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const redirectTo = typeof params?.redirectTo === "string" ? params.redirectTo : undefined;
  const invitationToken = typeof params?.invitationToken === "string" ? params.invitationToken : undefined;
  const patientInvitationToken = typeof params?.patientInvitationToken === "string" ? params.patientInvitationToken : undefined;
  const tokenParams = new URLSearchParams();
  if (redirectTo) tokenParams.set("redirectTo", redirectTo);
  if (patientInvitationToken) tokenParams.set("patientInvitationToken", patientInvitationToken);
  if (invitationToken) tokenParams.set("invitationToken", invitationToken);
  const tokenQuery = tokenParams.toString() ? `?${tokenParams.toString()}` : "";
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/accedi${tokenQuery}`);
  if (profile.onboardingStatus === "completed") {
    if (patientInvitationToken) redirect(`/inviti/paziente/accetta?${new URLSearchParams({ token: patientInvitationToken }).toString()}`);
    if (invitationToken) redirect(`/inviti/accetta?${new URLSearchParams({ token: invitationToken }).toString()}`);
    redirect(await resolvePostLoginDestination(redirectTo));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Torna alla home Beauty Broker World">
          <img src="/images/brand/logo-flat-dark-bronze.png" alt="" />
          <span>Beauty Broker World</span>
        </Link>
        <form action={logoutAction}>
          <button className={styles.homeLink} type="submit">Esci</button>
        </form>
      </header>
      <section className={styles.hero} aria-labelledby="onboarding-title">
        <div className={styles.visual} aria-hidden="true"><img src="/images/brand/logo-hero-watermark-large.png" alt="" /></div>
        <div className={styles.intro}>
          <p className={styles.overline}>Il tuo profilo</p>
          <h1 id="onboarding-title"><span>Cominciamo</span><span>da te.</span></h1>
          <p>Completa i dati minimi e indica il contesto con cui vuoi iniziare.</p>
        </div>
        <div className={styles.formShell} aria-label="Completamento profilo">
          <OnboardingForm
            profile={profile}
            redirectTo={redirectTo}
            invitationToken={invitationToken}
            patientInvitationToken={patientInvitationToken}
          />
        </div>
      </section>
    </main>
  );
}
