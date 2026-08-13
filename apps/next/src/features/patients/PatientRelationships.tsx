'use client';

import {
  patientLookupResponseSchema,
  patientRelationshipListSchema,
  patientRelationshipSchema,
  type PatientLookupResponse,
  type PatientRelationship,
} from '@bbw/interfaces';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import PlatformIcon from '../dashboard/PlatformIcon';
import {
  OrganizationEmptyState,
  OrganizationLoadingState,
  OrganizationPageShell,
  OrganizationSectionHeader,
  StatusBadge,
} from '../organizations/OrganizationPagePrimitives';

import styles from './PatientRelationships.module.css';

type ApiEnvelope = { success?: boolean; data?: unknown; code?: unknown };
type LookupMode = 'email' | 'taxCode';

function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

async function readEnvelope(response: Response): Promise<ApiEnvelope> {
  return response.json() as Promise<ApiEnvelope>;
}

function patientErrorMessage(code: string | null): string {
  const messages: Record<string, string> = {
    FORBIDDEN: 'Non hai i permessi necessari per gestire i clienti di questo contesto.',
    OPERATIONAL_CONTEXT_REQUIRED: 'Seleziona uno spazio operativo prima di gestire i clienti.',
    OPERATIONAL_CONTEXT_FORBIDDEN: 'Questo spazio operativo non è autorizzato per il tuo account.',
    PATIENT_NOT_FOUND: 'Non è stato trovato alcun account BBW con questo identificativo esatto.',
    PATIENT_LOOKUP_AMBIGUOUS: 'Il codice fiscale corrisponde a più account: il collegamento non è sicuro.',
    PATIENT_RELATIONSHIP_ALREADY_ACTIVE: 'Questo paziente è già collegato al contesto attivo.',
    PATIENT_RELATIONSHIP_NOT_FOUND: 'La relazione paziente non è più disponibile in questo contesto.',
  };
  return code ? messages[code] ?? 'Non è stato possibile completare l’operazione.' : 'Non è stato possibile completare l’operazione.';
}

function patientName(patient: Pick<PatientRelationship, 'firstName' | 'lastName' | 'email'>): string {
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.email;
}

function patientInitials(patient: Pick<PatientRelationship, 'firstName' | 'lastName' | 'email'>): string {
  const parts = [patient.firstName, patient.lastName].filter(Boolean) as string[];
  return parts.length > 0
    ? parts.map((part) => part[0]?.toUpperCase()).join('').slice(0, 2)
    : patient.email.slice(0, 2).toUpperCase();
}

export default function PatientRelationships({ canLink, canUnlink }: Readonly<{ canLink: boolean; canUnlink: boolean }>) {
  const [patients, setPatients] = useState<PatientRelationship[]>([]);
  const [query, setQuery] = useState('');
  const [lookupMode, setLookupMode] = useState<LookupMode>('email');
  const [lookupValue, setLookupValue] = useState('');
  const [lookupResult, setLookupResult] = useState<PatientLookupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/patients', { cache: 'no-store' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      const parsed = patientRelationshipListSchema.parse(envelope.data);
      setPatients(parsed.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Non è stato possibile caricare i clienti.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visiblePatients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('it');
    if (!normalizedQuery) return patients;
    return patients.filter((patient) => `${patientName(patient)} ${patient.email}`.toLocaleLowerCase('it').includes(normalizedQuery));
  }, [patients, query]);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = lookupValue.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setLookupResult(null);
    try {
      const response = await fetch('/api/backend/patients/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lookupMode === 'email' ? { email: value } : { taxCode: value }),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      setLookupResult(patientLookupResponseSchema.parse(envelope.data));
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Non è stato possibile cercare il paziente.');
    } finally {
      setBusy(false);
    }
  }

  async function linkPatient() {
    if (!lookupResult || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/backend/patients/relationships', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subjectId: lookupResult.subjectId }),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      patientRelationshipSchema.parse(envelope.data);
      setLookupResult(null);
      setLookupValue('');
      setNotice('Il paziente è stato collegato al contesto attivo.');
      await load();
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Non è stato possibile collegare il paziente.');
    } finally {
      setBusy(false);
    }
  }

  async function unlinkPatient(patient: PatientRelationship) {
    if (!canUnlink || busy) return;
    if (!window.confirm(`Rimuovere ${patientName(patient)} dai clienti di questo contesto?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/patients/relationships/${encodeURIComponent(patient.relationshipId)}`, { method: 'DELETE' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      setNotice(`${patientName(patient)} non è più collegato a questo contesto.`);
      await load();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : 'Non è stato possibile rimuovere la relazione.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <OrganizationPageShell>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Relazioni</p>
        <h1>Clienti</h1>
        <p>Gestisci i pazienti collegati a questo contesto.</p>
      </header>

      <section className={styles.relationshipSection} aria-labelledby="patient-relationships-title">
        <OrganizationSectionHeader id="patient-relationships-title" title="Clienti attivi" count={patients.length} />
        <div className={styles.toolbar}>
          <label className={styles.searchField} htmlFor="patient-search">
            <PlatformIcon name="search" size={18} />
            <span className={styles.srOnly}>Cerca tra i clienti collegati</span>
            <input id="patient-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca tra i clienti" type="search" />
          </label>
        </div>

        {canLink ? (
          <form className={styles.lookupForm} onSubmit={(event) => void lookup(event)}>
            <div className={styles.lookupIntro}>
              <p className={styles.cardEyebrow}>Collega un paziente esistente</p>
              <p>Cerca un account BBW usando email esatta o codice fiscale esatto.</p>
            </div>
            <div className={styles.lookupControls}>
              <label className={styles.lookupSelect}>
                <span className={styles.srOnly}>Tipo di identificativo</span>
                <select value={lookupMode} onChange={(event) => setLookupMode(event.target.value as LookupMode)}>
                  <option value="email">Email</option>
                  <option value="taxCode">Codice fiscale</option>
                </select>
              </label>
              <label className={styles.lookupInput}>
                <span className={styles.srOnly}>Identificativo esatto</span>
                <input value={lookupValue} onChange={(event) => setLookupValue(event.target.value)} placeholder={lookupMode === 'email' ? 'nome@email.it' : 'Codice fiscale'} type={lookupMode === 'email' ? 'email' : 'text'} required />
              </label>
              <button className={styles.primaryButton} disabled={busy} type="submit">{busy ? 'Ricerca…' : 'Cerca'}</button>
            </div>
            {lookupResult ? (
              <div className={styles.lookupResult}>
                <div>
                  <strong>{[lookupResult.firstName, lookupResult.lastName].filter(Boolean).join(' ') || lookupResult.email}</strong>
                  <span>{lookupResult.email}</span>
                </div>
                <button className={styles.secondaryButton} disabled={busy} onClick={() => void linkPatient()} type="button">Collega</button>
              </div>
            ) : null}
          </form>
        ) : null}

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        {loading ? <OrganizationLoadingState label="Caricamento clienti…" /> : null}
        {!loading && patients.length === 0 ? (
          <OrganizationEmptyState icon="clients" title="Non ci sono ancora clienti collegati." description={canLink ? 'Cerca un account BBW esistente per creare la prima relazione.' : 'Quando un paziente sarà collegato a questo contesto comparirà qui.'} />
        ) : null}
        {!loading && patients.length > 0 && visiblePatients.length === 0 ? (
          <OrganizationEmptyState icon="search" title="Nessun cliente corrisponde alla ricerca." description="Prova con un altro nome o indirizzo email." />
        ) : null}
        {!loading && visiblePatients.length > 0 ? (
          <ul className={styles.list} aria-label="Clienti attivi">
            {visiblePatients.map((patient) => (
              <li className={styles.patientRow} key={patient.relationshipId}>
                <span className={styles.avatar} aria-hidden="true">{patientInitials(patient)}</span>
                <div className={styles.identity}>
                  <Link href={`/clienti/${patient.relationshipId}`}>{patientName(patient)}</Link>
                  <span>{patient.email}</span>
                </div>
                <StatusBadge label="Attivo" tone="success" />
                {canUnlink ? <button className={styles.removeButton} disabled={busy} onClick={() => void unlinkPatient(patient)} type="button">Rimuovi</button> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </OrganizationPageShell>
  );
}
