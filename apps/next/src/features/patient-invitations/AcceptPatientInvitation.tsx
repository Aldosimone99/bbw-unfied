'use client';

import {
  patientInvitationAcceptRequestSchema,
  patientInvitationAcceptResponseSchema,
  patientInvitationLookupResponseSchema,
  type PatientInvitationAcceptResponse,
  type PatientInvitationLookupResponse,
} from '@bbw/interfaces';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import styles from '../organization-invitations/AcceptOrganizationInvitation.module.css';

type ApiEnvelope = { success?: boolean; data?: unknown; code?: unknown };

function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

async function readEnvelope(response: Response): Promise<ApiEnvelope> {
  return response.json() as Promise<ApiEnvelope>;
}

function errorMessage(code: string | null): string {
  const messages: Record<string, string> = {
    PATIENT_INVITATION_NOT_FOUND: 'Questo invito paziente non è valido.',
    PATIENT_INVITATION_EXPIRED: 'Questo invito paziente è scaduto.',
    PATIENT_INVITATION_REVOKED: 'Questo invito paziente è stato revocato.',
    PATIENT_INVITATION_ALREADY_ACCEPTED: 'Questo invito paziente è già stato accettato.',
    PATIENT_INVITATION_EMAIL_MISMATCH: 'Questo invito è destinato a un altro account.',
    PATIENT_RELATIONSHIP_ALREADY_ACTIVE: 'Sei già collegato a questa struttura.',
    FORBIDDEN: 'La struttura non è più disponibile.',
  };
  return code ? messages[code] ?? 'Non è stato possibile verificare l’invito.' : 'Non è stato possibile verificare l’invito.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AcceptPatientInvitation({ token }: Readonly<{ token: string }>) {
  const parsedToken = patientInvitationAcceptRequestSchema.safeParse({ token });
  const invitationToken = parsedToken.success ? parsedToken.data.token : null;
  const [invitation, setInvitation] = useState<PatientInvitationLookupResponse | null>(null);
  const [accepted, setAccepted] = useState<PatientInvitationAcceptResponse | null>(null);
  const [error, setError] = useState<string | null>(() => invitationToken ? null : 'Questo invito paziente non è valido.');
  const [loading, setLoading] = useState(Boolean(invitationToken));
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!invitationToken) return;
    let cancelled = false;
    async function lookup() {
      try {
        const response = await fetch('/api/backend/patients/invitations/lookup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: invitationToken }),
          cache: 'no-store',
        });
        const envelope = await readEnvelope(response);
        if (!response.ok || !envelope.success) throw new Error(errorMessage(errorCode(envelope)));
        const parsed = patientInvitationLookupResponseSchema.parse(envelope.data);
        if (!cancelled) {
          setInvitation(parsed);
          setError(null);
        }
      } catch (lookupError) {
        if (!cancelled) {
          setInvitation(null);
          setError(lookupError instanceof Error ? lookupError.message : 'Non è stato possibile verificare l’invito.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void lookup();
    return () => { cancelled = true; };
  }, [invitationToken]);

  async function accept() {
    if (!invitationToken) return;
    setAccepting(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/patients/invitations/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: invitationToken }),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(errorMessage(errorCode(envelope)));
      setAccepted(patientInvitationAcceptResponseSchema.parse(envelope.data));
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Non è stato possibile accettare l’invito.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="accept-patient-invitation-title">
        <p className={styles.eyebrow}>Beauty Broker World</p>
        {loading ? <p role="status">Verifica invito in corso…</p> : null}
        {!loading && error && !accepted ? <><h1 id="accept-patient-invitation-title">Invito non disponibile</h1><p className={styles.error} role="alert">{error}</p></> : null}
        {!loading && invitation && !accepted ? (
          <>
            <h1 id="accept-patient-invitation-title">{invitation.organizationName} ti invita a collegarti come paziente.</h1>
            <p>Accettando, la struttura potrà gestire il rapporto con te all’interno di BBW. Non diventerai membro della struttura e non riceverai un nuovo workspace.</p>
            <dl>
              <div><dt>Invito valido fino al</dt><dd>{formatDate(invitation.expiresAt)}</dd></div>
            </dl>
            <button type="button" onClick={() => void accept()} disabled={accepting}>
              {accepting ? 'Accettazione…' : 'Accetta invito'}
            </button>
          </>
        ) : null}
        {accepted ? (
          <>
            <h1 id="accept-patient-invitation-title">Collegamento completato</h1>
            <p>Ora sei collegato a <strong>{accepted.organizationName}</strong> come paziente. Il tuo account BBW e i tuoi workspace personali restano invariati.</p>
            <div className={styles.actions}>
              <Link href="/dashboard">Vai alla dashboard</Link>
              <Link href="/profilo">Vai al profilo</Link>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
