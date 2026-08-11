import Link from "next/link";

import styles from "./Dashboard.module.css";

export default function DashboardForbidden() {
  return (
    <main className={styles.page}>
      <section className={styles.forbidden} aria-labelledby="forbidden-title">
        <p className={styles.overline}>Accesso limitato</p>
        <h1 id="forbidden-title">Non hai il permesso per questa area.</h1>
        <p>Il tuo account è autenticato, ma non dispone di `dashboard.access`.</p>
        <Link className={styles.backLink} href="/">
          Torna alla home
        </Link>
      </section>
    </main>
  );
}
