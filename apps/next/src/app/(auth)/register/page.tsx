import type { Metadata } from "next";
import Link from "next/link";

import RegisterForm from "../../../features/auth/RegisterForm";
import styles from "../../../components/forms/AuthPage.module.css";

export const metadata: Metadata = {
  title: "Registrati | Beauty Broker World",
  description: "Crea il tuo account Beauty Broker World."
};

type RegisterPageProps = {
  searchParams?: Promise<{
    redirectTo?: string | string[];
    invitationToken?: string | string[];
    patientInvitationToken?: string | string[];
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const redirectTo = typeof params?.redirectTo === "string" ? params.redirectTo : undefined;
  const invitationToken = typeof params?.invitationToken === "string" ? params.invitationToken : undefined;
  const patientInvitationToken = typeof params?.patientInvitationToken === "string" ? params.patientInvitationToken : undefined;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Torna alla home Beauty Broker World">
          <img src="/images/brand/logo-flat-dark-bronze.png" alt="" />
          <span>Beauty Broker World</span>
        </Link>
        <Link className={styles.homeLink} href="/accedi">
          Torna al login
        </Link>
      </header>

      <section className={styles.hero} aria-labelledby="register-title">
        <div className={styles.visual} aria-hidden="true">
          <img src="/images/brand/logo-hero-watermark-large.png" alt="" />
        </div>
        <div className={styles.intro}>
          <p className={styles.overline}>Nuovo profilo</p>
          <h1 id="register-title">
            <span>Crea il tuo</span>
            <span>account.</span>
          </h1>
          <p>Inizia con un profilo personale. Potrai completare il tuo contesto in un secondo momento.</p>
        </div>
        <div className={styles.formShell} aria-label="Registrazione">
          <RegisterForm
            redirectTo={redirectTo}
            invitationToken={invitationToken}
            patientInvitationToken={patientInvitationToken}
          />
        </div>
      </section>
    </main>
  );
}
