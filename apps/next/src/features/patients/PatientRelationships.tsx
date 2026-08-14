'use client';

import {
  createPatientInvitationRequestSchema,
  patientInvitationListResponseSchema,
  patientInvitationLinkResponseSchema,
  patientLookupResponseSchema,
  patientRelationshipListSchema,
  patientRelationshipSchema,
  type PatientInvitation,
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
    FORBIDDEN: 'Non hai i permessi necessari per gestire i pazienti di questo contesto.',
    OPERATIONAL_CONTEXT_REQUIRED: 'Seleziona uno spazio operativo prima di gestire i pazienti.',
    OPERATIONAL_CONTEXT_FORBIDDEN: 'Questo spazio operativo non è autorizzato per il tuo account.',
    PATIENT_NOT_FOUND: 'Non è stato trovato alcun account BBW con questo identificativo esatto.',
    PATIENT_LOOKUP_AMBIGUOUS: 'Il codice fiscale corrisponde a più account: il collegamento non è sicuro.',
    PATIENT_RELATIONSHIP_ALREADY_ACTIVE: 'Questo paziente è già collegato al contesto attivo.',
    PATIENT_RELATIONSHIP_NOT_FOUND: 'La relazione paziente non è più disponibile in questo contesto.',
    PATIENT_INVITATION_ALREADY_PENDING: 'Esiste già un invito paziente in attesa per questo indirizzo email.',
    PATIENT_INVITATION_EXPIRED: 'L’invito paziente è scaduto. Creane uno nuovo.',
    PATIENT_INVITATION_NOT_FOUND: 'L’invito paziente non è più disponibile.',
    PATIENT_INVITATION_REVOKED: 'L’invito paziente è stato revocato.',
    PATIENT_INVITATION_ALREADY_ACCEPTED: 'L’invito paziente è già stato accettato.',
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

export default function PatientRelationships({ canLink, canUnlink, canInvite }: Readonly<{ canLink: boolean; canUnlink: boolean; canInvite: boolean }>) {
  const [patients, setPatients] = useState<PatientRelationship[]>([]);
  const [invitations, setInvitations] = useState<PatientInvitation[]>([]);
  const [query, setQuery] = useState('');
  const [lookupMode, setLookupMode] = useState<LookupMode>('email');
  const [lookupValue, setLookupValue] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [lookupResult, setLookupResult] = useState<PatientLookupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invitationBusy, setInvitationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientsLoadError, setPatientsLoadError] = useState<string | null>(null);
  const [invitationsLoadError, setInvitationsLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function openInviteDialog() {
    setError(null);
    setInviteDialogOpen(true);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setPatientsLoadError(null);
    setError(null);
    try {
      const response = await fetch('/api/backend/patients', { cache: 'no-store' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      const parsed = patientRelationshipListSchema.parse(envelope.data);
      setPatients(parsed.items);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Non è stato possibile caricare i pazienti.';
      setPatientsLoadError(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const loadInvitations = useCallback(async () => {
    if (!canInvite) return;
    setInvitationsLoading(true);
    setInvitationsLoadError(null);
    try {
      const response = await fetch('/api/backend/patients/invitations', { cache: 'no-store' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      setInvitations(patientInvitationListResponseSchema.parse(envelope.data).items);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Non è stato possibile caricare gli inviti paziente.';
      setInvitationsLoadError(message);
      setError(message);
    } finally {
      setInvitationsLoading(false);
    }
  }, [canInvite]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInvitations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadInvitations]);

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === 'pending'),
    [invitations],
  );

  const visiblePatients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('it');
    if (!normalizedQuery) return patients;
    return patients.filter((patient) => `${patientName(patient)} ${patient.email}`.toLocaleLowerCase('it').includes(normalizedQuery));
  }, [patients, query]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canInvite || invitationBusy) return;
    setInvitationBusy(true);
    setError(null);
    setNotice(null);
    setLatestInviteLink(null);
    try {
      const payload = createPatientInvitationRequestSchema.parse({ email: inviteEmail });
      const response = await fetch('/api/backend/patients/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      const data = envelope.data as { acceptLink?: unknown };
      if (typeof data.acceptLink !== 'string') throw new Error('Il link invito non è disponibile. Riprova.');
      setLatestInviteLink(data.acceptLink);
      setInviteEmail('');
      setInviteDialogOpen(false);
      setNotice('Invito paziente creato. Copia il link ora: non viene conservato nel database.');
      await loadInvitations();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Non è stato possibile creare l’invito paziente.');
    } finally {
      setInvitationBusy(false);
    }
  }

  async function copyInvitationLink(invitation: PatientInvitation) {
    if (!canInvite || invitationBusy) return;
    setInvitationBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/patients/invitations/${encodeURIComponent(invitation.id)}/link`, { method: 'POST' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      const link = patientInvitationLinkResponseSchema.parse(envelope.data).acceptLink;
      setLatestInviteLink(link);
      try {
        await navigator.clipboard.writeText(link);
        setNotice('Link invito copiato negli appunti.');
      } catch {
        setNotice('Link rigenerato. Copialo dal pannello mostrato qui sotto.');
      }
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Non è stato possibile generare il link invito.');
    } finally {
      setInvitationBusy(false);
    }
  }

  async function revokeInvitation(invitation: PatientInvitation) {
    if (!canInvite || invitationBusy) return;
    if (!window.confirm(`Revocare l’invito per ${invitation.email}?`)) return;
    setInvitationBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/patients/invitations/${encodeURIComponent(invitation.id)}`, { method: 'DELETE' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(patientErrorMessage(errorCode(envelope)));
      setNotice('Invito paziente revocato. Il link non è più utilizzabile.');
      await loadInvitations();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Non è stato possibile revocare l’invito paziente.');
    } finally {
      setInvitationBusy(false);
    }
  }

  async function copyInviteLink() {
    if (!latestInviteLink) return;
    try {
      await navigator.clipboard.writeText(latestInviteLink);
      setNotice('Link invito copiato negli appunti.');
    } catch {
      setNotice('Copia manualmente il link mostrato qui sotto.');
    }
  }

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
    if (!window.confirm(`Rimuovere ${patientName(patient)} dai pazienti di questo contesto?`)) return;
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
        <div>
          <p className={styles.eyebrow}>Gestione</p>
          <h1>Pazienti</h1>
          <p>Gestisci i pazienti collegati alla struttura.</p>
        </div>
        {canInvite ? <button className={styles.primaryButton} onClick={openInviteDialog} type="button">Invita paziente</button> : null}
      </header>

      {latestInviteLink ? (
        <section className={styles.linkPanel} aria-labelledby="latest-patient-invitation-title">
          <div>
            <p className={styles.cardEyebrow}>Link appena creato</p>
            <h2 id="latest-patient-invitation-title">Condividi l’invito</h2>
            <p>Per sicurezza il link viene mostrato solo ora e non viene conservato nel database.</p>
          </div>
          <div className={styles.lookupControls}>
            <label className={styles.lookupInput} htmlFor="latest-patient-invitation-link">
              <span className={styles.srOnly}>Link invito paziente</span>
              <input id="latest-patient-invitation-link" value={latestInviteLink} readOnly />
            </label>
            <button className={styles.secondaryButton} onClick={() => void copyInviteLink()} type="button">Copia link</button>
          </div>
        </section>
      ) : null}

      {canInvite ? (
        <section className={styles.invitationSection} aria-labelledby="pending-patient-invitations-title">
          <OrganizationSectionHeader id="pending-patient-invitations-title" title="Inviti in attesa" count={pendingInvitations.length} />
          {invitationsLoading ? <OrganizationLoadingState label="Caricamento inviti paziente…" /> : null}
          {!invitationsLoading && !invitationsLoadError && pendingInvitations.length === 0 ? <OrganizationEmptyState icon="invites" title="Nessun invito in attesa." description="Gli inviti paziente compariranno qui finché non verranno accettati." /> : null}
          {!invitationsLoading && !invitationsLoadError && pendingInvitations.length > 0 ? (
            <ul className={styles.list} aria-label="Inviti paziente in attesa">
              {pendingInvitations.map((invitation) => (
                <li className={styles.invitationRow} key={invitation.id}>
                  <div className={styles.identity}>
                    <strong>{invitation.email}</strong>
                    <span>Scade il {new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(invitation.expiresAt))}</span>
                  </div>
                  <StatusBadge label="In attesa" tone="warning" />
                  <div className={styles.invitationActions}>
                    <button className={styles.secondaryButton} disabled={invitationBusy} onClick={() => void copyInvitationLink(invitation)} type="button">Copia link</button>
                    <button className={styles.removeButton} disabled={invitationBusy} onClick={() => void revokeInvitation(invitation)} type="button">Revoca</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className={styles.relationshipSection} aria-labelledby="patient-relationships-title">
        <OrganizationSectionHeader id="patient-relationships-title" title="Pazienti attivi" count={patients.length} />
        <div className={styles.toolbar}>
          <label className={styles.searchField} htmlFor="patient-search">
            <PlatformIcon name="search" size={18} />
            <span className={styles.srOnly}>Cerca tra i pazienti collegati</span>
            <input id="patient-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca tra i pazienti" type="search" />
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
        {loading ? <OrganizationLoadingState label="Caricamento pazienti…" /> : null}
        {!loading && !patientsLoadError && patients.length === 0 ? (
          <OrganizationEmptyState
            icon="clients"
            title="Nessun paziente collegato"
            description={canLink ? 'Cerca un account BBW esistente per creare la prima relazione.' : 'Quando un paziente sarà collegato a questo contesto comparirà qui.'}
            action={canInvite ? <button className={styles.primaryButton} onClick={openInviteDialog} type="button">Invita paziente</button> : undefined}
          />
        ) : null}
        {!loading && !patientsLoadError && patients.length > 0 && visiblePatients.length === 0 ? (
          <OrganizationEmptyState icon="search" title="Nessun paziente corrisponde alla ricerca." description="Prova con un altro nome o indirizzo email." />
        ) : null}
        {!loading && !patientsLoadError && visiblePatients.length > 0 ? (
          <ul className={styles.list} aria-label="Pazienti attivi">
            {visiblePatients.map((patient) => (
              <li className={styles.patientRow} key={patient.relationshipId}>
                <span className={styles.avatar} aria-hidden="true">{patientInitials(patient)}</span>
                <div className={styles.identity}>
                  <Link href={`/pazienti/${patient.relationshipId}`}>{patientName(patient)}</Link>
                  <span>{patient.email}</span>
                  <span>Paziente dal {new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(patient.linkedAt))}</span>
                </div>
                <StatusBadge label="Attivo" tone="success" />
                {canUnlink ? <button className={styles.removeButton} disabled={busy} onClick={() => void unlinkPatient(patient)} type="button">Rimuovi</button> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {inviteDialogOpen ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="patient-invitation-dialog-title">
            <p className={styles.cardEyebrow}>Nuovo invito</p>
            <h2 id="patient-invitation-dialog-title">Invita paziente</h2>
            <p>Il paziente riceverà un link per registrarsi o accedere a BBW e collegarsi a questa struttura.</p>
            <form className={styles.inviteForm} onSubmit={(event) => void createInvitation(event)}>
              <label htmlFor="patient-invitation-email">Email del paziente</label>
              <input id="patient-invitation-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} autoComplete="email" placeholder="nome@email.it" required disabled={invitationBusy} />
              <div className={styles.dialogActions}>
                <button className={styles.secondaryButton} disabled={invitationBusy} onClick={() => setInviteDialogOpen(false)} type="button">Annulla</button>
                <button className={styles.primaryButton} disabled={invitationBusy} type="submit">{invitationBusy ? 'Invio…' : 'Invia invito'}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </OrganizationPageShell>
  );
}
