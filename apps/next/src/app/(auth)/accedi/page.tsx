import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "../../../features/auth/LoginForm";
import styles from "../../../components/forms/AuthPage.module.css";

export const metadata: Metadata = {
  title: "Accedi | Beauty Broker World",
  description: "Accedi al tuo account Beauty Broker World."
};

type AccediPageProps = {
  searchParams?: Promise<{ redirectTo?: string | string[] }>;
};

export default async function AccediPage({ searchParams }: AccediPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const redirectTo = typeof params?.redirectTo === "string" ? params.redirectTo : undefined;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Torna alla home Beauty Broker World">
          <img src="/images/brand/logo-flat-dark-bronze.png" alt="" />
          <span>Beauty Broker World</span>
        </Link>
        <Link className={styles.homeLink} href="/">
          Home
        </Link>
      </header>

      <section className={styles.hero} aria-labelledby="access-title">
        <div className={styles.visual} aria-hidden="true">
          <img src="/images/brand/logo-hero-watermark-large.png" alt="" />
        </div>

        <div className={styles.intro}>
          <h1 id="access-title">
            <span>Accedi al</span>
            <span>tuo</span>
            <span>percorso.</span>
          </h1>
          <p>
            Entra nella piattaforma Beauty Broker World e continua il tuo percorso con specialisti, strumenti digitali
            e supporto dedicato.
          </p>
        </div>

        <div className={styles.formShell} aria-label="Accesso">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </section>
    </main>
  );
}
