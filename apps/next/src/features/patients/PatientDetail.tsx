'use client';

import { patientRelationshipSchema, type PatientRelationship } from '@bbw/interfaces';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  OrganizationEmptyState,
  OrganizationLoadingState,
  OrganizationPageShell,
  StatusBadge,
} from '../organizations/OrganizationPagePrimitives';

import styles from './PatientDetail.module.css';

type ApiEnvelope = { success?: boolean; data?: unknown; code?: unknown };

function patientName(patient: PatientRelationship): string {
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.email;
}

function errorMessage(payload: unknown): string {
  const code = payload && typeof payload === 'object' && typeof (payload as { code?: unknown }).code === 'string'
    ? (payload as { code: string }).code
    : null;
  if (code === 'PATIENT_RELATIONSHIP_NOT_FOUND') return 'Questo paziente non è collegato al contesto attivo.';
  if (code === 'FORBIDDEN') return 'Non hai i permessi per visualizzare questo paziente.';
  return 'Non è stato possibile caricare il dettaglio del paziente.';
}

export default function PatientDetail({ relationshipId }: Readonly<{ relationshipId: string }>) {
  const [patient, setPatient] = useState<PatientRelationship | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/backend/patients/relationships/${encodeURIComponent(relationshipId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as ApiEnvelope | null;
        if (!response.ok || !payload?.success) throw new Error(errorMessage(payload));
        setPatient(patientRelationshipSchema.parse(payload.data));
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Non è stato possibile caricare il dettaglio del paziente.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [relationshipId]);

  return (
    <OrganizationPageShell>
      <Link className={styles.backLink} href="/pazienti">← Torna ai clienti</Link>
      {loading ? <OrganizationLoadingState label="Caricamento dettaglio…" /> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {!loading && !error && !patient ? <OrganizationEmptyState icon="clients" title="Paziente non disponibile." description="La relazione potrebbe essere stata rimossa o appartenere a un altro contesto." /> : null}
      {patient ? (
        <article className={styles.card}>
          <p className={styles.eyebrow}>Relazione paziente</p>
          <h1>{patientName(patient)}</h1>
          <StatusBadge label="Attivo" tone="success" />
          <dl className={styles.details}>
            <div><dt>Email</dt><dd>{patient.email}</dd></div>
            <div><dt>Telefono</dt><dd>{patient.phone || 'Non disponibile'}</dd></div>
            <div><dt>Data di nascita</dt><dd>{patient.birthDate || 'Non disponibile'}</dd></div>
            <div><dt>Data collegamento</dt><dd>{new Date(patient.linkedAt).toLocaleDateString('it-IT')}</dd></div>
            <div><dt>Scope relazione</dt><dd>{patient.relationshipScope === 'organization' ? 'Struttura attiva' : 'Studio personale'}</dd></div>
          </dl>
          <p className={styles.note}>Questa vista contiene solo dati anagrafici minimi. Non include dati clinici, consensi, trattamenti o pagamenti.</p>
        </article>
      ) : null}
    </OrganizationPageShell>
  );
}
