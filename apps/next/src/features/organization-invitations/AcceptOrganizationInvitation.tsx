'use client';

import { companyInviteAcceptSchema, companyInviteLookupResponseSchema, type CompanyInviteLookupResponse } from '@bbw/interfaces';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import styles from './AcceptOrganizationInvitation.module.css';

type ApiEnvelope = { success?: boolean; data?: unknown; code?: unknown };

function codeFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

async function readEnvelope(response: Response): Promise<ApiEnvelope> {
  return response.json() as Promise<ApiEnvelope>;
}

function errorMessage(code: string | null): string {
  const messages: Record<string, string> = {
    INVITATION_NOT_FOUND: 'Questo invito non è valido.',
    INVITATION_EXPIRED: 'Questo invito è scaduto.',
    INVITATION_REVOKED: 'Questo invito è stato revocato.',
    INVITATION_ALREADY_ACCEPTED: 'Questo invito è già stato accettato.',
    INVITATION_EMAIL_MISMATCH: 'Questo invito è destinato a un altro account.',
    MEMBERSHIP_ALREADY_EXISTS: 'Questo account appartiene già a questa organizzazione.',
    MEMBERSHIP_NOT_ACTIVE: 'La membership esistente non è attiva. Contatta l’organizzazione.',
    INVITATION_ROLE_NOT_MEDICAL: 'Questo invito non è configurato per un medico.',
    INVITATION_RECIPIENT_NOT_PHYSICIAN: 'L’account destinatario non risulta configurato come medico.',
    FORBIDDEN: 'Non puoi accettare questo invito.',
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
    second: '2-digit',
  }).format(new Date(value));
}

export default function AcceptOrganizationInvitation({ token }: Readonly<{ token: string }>) {
  const parsedToken = companyInviteAcceptSchema.safeParse({ token });
  const invitationToken = parsedToken.success ? parsedToken.data?.token ?? null : null;
  const [lookupToken, setLookupToken] = useState<string | null>(invitationToken);
  const [invite, setInvite] = useState<CompanyInviteLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(() => invitationToken ? null : 'Questo invito non è valido.');
  const [loading, setLoading] = useState(() => Boolean(invitationToken));
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const isCurrentLookup = lookupToken === invitationToken;
  const visibleInvite = isCurrentLookup ? invite : null;
  const visibleError = invitationToken ? (isCurrentLookup ? error : null) : 'Questo invito non è valido.';
  const visibleLoading = invitationToken ? (isCurrentLookup ? loading : true) : false;
  const visibleAccepted = isCurrentLookup && accepted;

  useEffect(() => {
    if (!invitationToken) return;

    let cancelled = false;

    async function lookup(verifiedToken: string) {
      try {
        const response = await fetch('/api/backend/company/invites/lookup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: verifiedToken }),
          cache: 'no-store',
        });
        const envelope = await readEnvelope(response);
        if (!response.ok || !envelope.success) throw new Error(errorMessage(codeFrom(envelope)));
        const parsedInvite = companyInviteLookupResponseSchema.parse(envelope.data);
        if (cancelled) return;
        setLookupToken(verifiedToken);
        setInvite(parsedInvite);
        setError(null);
        setAccepted(false);
      } catch (lookupError) {
        if (cancelled) return;
        setLookupToken(verifiedToken);
        setInvite(null);
        setError(lookupError instanceof Error ? lookupError.message : 'Non è stato possibile verificare l’invito.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void lookup(invitationToken);
    return () => {
      cancelled = true;
    };
  }, [invitationToken]);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/company/invites/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: invitationToken }),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(errorMessage(codeFrom(envelope)));
      setAccepted(true);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Non è stato possibile accettare l’invito.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="accept-organization-invitation-title">
        <p className={styles.eyebrow}>Beauty Broker World</p>
        {visibleLoading ? <p role="status">Verifica invito in corso…</p> : null}
        {!visibleLoading && visibleError ? <><h1 id="accept-organization-invitation-title">Invito non disponibile</h1><p className={styles.error} role="alert">{visibleError}</p></> : null}
        {!visibleLoading && visibleInvite && !visibleAccepted ? (
          <>
            <h1 id="accept-organization-invitation-title">{visibleInvite.organizationName} ti ha invitato</h1>
            <dl>
              <div><dt>Ruolo</dt><dd>{visibleInvite.role}</dd></div>
              <div><dt>Invito valido fino al</dt><dd>{formatDate(visibleInvite.expiresAt)}</dd></div>
            </dl>
            <button type="button" onClick={() => void accept()} disabled={accepting}>
              {accepting ? 'Accettazione…' : 'Accetta invito'}
            </button>
          </>
        ) : null}
        {visibleAccepted && visibleInvite ? (
          <>
            <h1 id="accept-organization-invitation-title">Invito accettato</h1>
            <p>Ora puoi accedere a <strong>{visibleInvite.organizationName}</strong>. Il tuo Studio personale resta separato e il contesto non è stato cambiato automaticamente.</p>
            <div className={styles.actions}>
              <Link href="/seleziona-contesto">Entra nella clinica</Link>
              <Link href="/dashboard">Resta nello Studio personale</Link>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
