import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import OnboardingForm from "../../../features/auth/OnboardingForm";
import styles from "../../../components/forms/AuthPage.module.css";
import { getCurrentProfile } from "../../../server/auth/current-user";
import { getOrganizationTypeOptions } from "../../../server/services/auth-service";

export const metadata: Metadata = {
  title: "Completa il profilo | Beauty Broker World",
  description: "Completa il tuo profilo Beauty Broker World."
};

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.onboardingStatus === "completed") {
    redirect("/dashboard");
  }

  const organizationTypes = await getOrganizationTypeOptions();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Torna alla home Beauty Broker World">
          <img src="/images/brand/logo-flat-dark-bronze.png" alt="" />
          <span>Beauty Broker World</span>
        </Link>
        <a className={styles.homeLink} href="/accedi">
          Accedi
        </a>
      </header>

      <section className={styles.hero} aria-labelledby="onboarding-title">
        <div className={styles.visual} aria-hidden="true">
          <img src="/images/brand/logo-hero-watermark-large.png" alt="" />
        </div>
        <div className={styles.intro}>
          <p className={styles.overline}>Il tuo profilo</p>
          <h1 id="onboarding-title">
            <span>Cominciamo</span>
            <span>da te.</span>
          </h1>
          <p>Completa i dati minimi e indicaci il contesto con cui vuoi iniziare.</p>
        </div>
        <div className={styles.formShell} aria-label="Onboarding profilo">
          <OnboardingForm profile={profile} organizationTypes={organizationTypes} />
        </div>
      </section>
    </main>
  );
}
