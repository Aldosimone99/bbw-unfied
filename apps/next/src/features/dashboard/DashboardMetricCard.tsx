import type { PlatformIconName } from "./PlatformIcon";
import PlatformIcon from "./PlatformIcon";
import styles from "./Dashboard.module.css";

type DashboardMetricCardProps = {
  icon: PlatformIconName;
  label: string;
  secondaryLabel: string;
  emptyMessage: string;
};

export default function DashboardMetricCard({
  icon,
  label,
  secondaryLabel,
  emptyMessage,
}: DashboardMetricCardProps) {
  return (
    <article className={styles.metricCard} aria-label={label}>
      <span className={styles.metricIcon}>
        <PlatformIcon name={icon} size={20} />
      </span>
      <p className={styles.cardLabel}>{label}</p>
      <div className={styles.metricBlock}>
        <strong className={styles.metricValue} aria-label={`${label}: dato non disponibile`}>
          —
        </strong>
        <span className={styles.metricLabel}>{secondaryLabel}</span>
      </div>
      <p className={styles.metricEmpty}>{emptyMessage}</p>
    </article>
  );
}
