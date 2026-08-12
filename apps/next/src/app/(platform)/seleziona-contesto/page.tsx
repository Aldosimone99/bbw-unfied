import Link from 'next/link';
import { redirect } from 'next/navigation';

import OperationalContextCard from '../../../features/operational-context/OperationalContextCard';
import { getOperationalContextKey } from '../../../features/operational-context/labels';
import styles from '../../../features/operational-context/ContextSelection.module.css';
import { getPostLoginContext } from '../../../server/services/post-login-service';

export default async function SelectOperationalContextPage() {
  const context = await getPostLoginContext();
  if (!context.user) redirect('/login');
  if (context.profile?.onboardingStatus !== 'completed') redirect('/onboarding');
  if (context.availableOperationalContexts.length === 0) redirect('/dashboard');
  if (context.availableOperationalContexts.length === 1) redirect('/dashboard');

  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="select-operational-context-title">
        <p className={styles.eyebrow}>Beauty Broker World</p>
        <h1 className={styles.heading} id="select-operational-context-title">Dove vuoi entrare?</h1>
        <p className={styles.intro}>Scegli il workspace in cui lavorare. Il contesto determina lo scope operativo, mentre autorizzazioni e permessi restano verificati dal server.</p>
        {context.activeOperationalContext ? (
          <div className={styles.activeNotice}>
            <p>Stai operando in <strong>{context.activeOperationalContext.label}</strong>.</p>
            <Link className={styles.backLink} href="/dashboard">Torna alla dashboard</Link>
          </div>
        ) : null}
        <div className={styles.contexts}>
          {context.availableOperationalContexts.map((operationalContext) => (
            <OperationalContextCard context={operationalContext} key={getOperationalContextKey(operationalContext)} />
          ))}
        </div>
      </section>
    </main>
  );
}
