import { redirect } from "next/navigation";
import Link from "next/link";

import OnboardingForm from "../../../features/auth/OnboardingForm";
import { getCurrentProfile } from "../../../server/auth/current-user";
import styles from "../../../components/forms/AuthPage.module.css";

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/accedi");
  if (profile.onboardingStatus === "completed") redirect("/dashboard");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Torna alla home Beauty Broker World">
          <img src="/images/brand/logo-flat-dark-bronze.png" alt="" />
          <span>Beauty Broker World</span>
        </Link>
        <Link className={styles.homeLink} href="/accedi">Esci</Link>
      </header>
      <section className={styles.hero} aria-labelledby="onboarding-title">
        <div className={styles.visual} aria-hidden="true"><img src="/images/brand/logo-hero-watermark-large.png" alt="" /></div>
        <div className={styles.intro}>
          <p className={styles.overline}>Il tuo profilo</p>
          <h1 id="onboarding-title"><span>Cominciamo</span><span>da te.</span></h1>
          <p>Completa i dati minimi e indica il contesto con cui vuoi iniziare.</p>
        </div>
        <div className={styles.formShell} aria-label="Completamento profilo">
          <OnboardingForm profile={profile} />
        </div>
      </section>
    </main>
  );
}
