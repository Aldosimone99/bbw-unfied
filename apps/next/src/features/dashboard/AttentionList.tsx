import { ArrowRight } from "lucide-react";

import PlatformIcon from "./PlatformIcon";
import styles from "./Dashboard.module.css";

export type AttentionItem = {
  label: string;
  detail: string;
  href?: string;
};

type AttentionListProps = {
  /** Collegare qui le attività operative già autorizzate dal relativo read model. */
  items?: AttentionItem[];
};

export default function AttentionList({ items = [] }: AttentionListProps) {
  return (
    <section className={`${styles.surfaceCard} ${styles.attentionCard}`} aria-labelledby="attention-title">
      <div className={styles.sectionHeading}>
        <span className={styles.cardMark}>
          <PlatformIcon name="attention" size={20} />
        </span>
        <div>
          <p className={styles.cardLabel}>Richiede attenzione</p>
          <h2 id="attention-title">Attività da verificare</h2>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className={styles.attentionList}>
          {items.map((item) => (
            <li key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              {item.href ? (
                <a href={item.href} aria-label={`Apri: ${item.label}`}>
                  <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.attentionEmpty}>
          <PlatformIcon name="success" size={18} />
          Nessuna attività richiede attenzione.
        </p>
      )}
    </section>
  );
}
