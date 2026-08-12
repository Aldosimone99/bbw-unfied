import { ArrowRight } from "lucide-react";

import PlatformIcon from "./PlatformIcon";
import styles from "./Dashboard.module.css";

function formatTodayDate() {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  }).format(new Date());
}

export default function TodaySchedule() {
  return (
    <section className={styles.todaySection} aria-labelledby="today-title">
      <div className={styles.todayHeader}>
        <div>
          <p className={styles.eyebrow}>Agenda operativa</p>
          <h2 id="today-title">Oggi</h2>
        </div>
        <span className={styles.todayDate}>{formatTodayDate()}</span>
      </div>
      <div className={styles.scheduleEmpty}>
        <span className={styles.emptyIcon}>
          <PlatformIcon name="appointments" size={20} />
        </span>
        <div>
          <strong>Nessun appuntamento previsto oggi.</strong>
        </div>
        <a className={styles.textLink} href="/calendario">
          Apri calendario
          <ArrowRight className={styles.textLinkArrow} size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
        </a>
      </div>
    </section>
  );
}
