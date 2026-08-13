'use client';

import { companyInviteListResponseSchema, type CompanyInviteRow } from '@bbw/interfaces';
import { useCallback, useEffect, useMemo, useState } from 'react';

import styles from './OrganizationInvitations.module.css';

type ApiEnvelope = { success?: boolean; data?: unknown; code?: unknown };
type HistoryDialog = { kind: 'clear' } | { kind: 'hide'; invitation: CompanyInviteRow } | null;

function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

async function readEnvelope(response: Response): Promise<ApiEnvelope> {
  return response.json() as Promise<ApiEnvelope>;
}

function invitationErrorMessage(code: string | null): string {
  const messages: Record<string, string> = {
    FORBIDDEN: 'Non hai i permessi necessari per gestire gli inviti in questo contesto.',
    INVITATION_ALREADY_PENDING: 'Esiste già un invito in attesa per questo indirizzo email.',
    INVITATION_NOT_FOUND: 'L’invito non è più disponibile.',
    INVITATION_NOT_PENDING: 'Questo invito non può più essere modificato.',
    INVITATION_PENDING_HISTORY_HIDE_NOT_ALLOWED: 'Un invito in attesa deve essere prima revocato.',
  };
  return code ? messages[code] ?? 'Non è stato possibile completare l’operazione.' : 'Non è stato possibile completare l’operazione.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function statusLabel(status: CompanyInviteRow['status']): string {
  return ({ pending: 'In attesa', accepted: 'Accettato', revoked: 'Revocato', expired: 'Scaduto' })[status];
}

export default function OrganizationInvitations({ organizationName }: Readonly<{ organizationName: string }>) {
  const [invitations, setInvitations] = useState<CompanyInviteRow[]>([]);
  const [email, setEmail] = useState('');
  const [latestLink, setLatestLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [historyDialog, setHistoryDialog] = useState<HistoryDialog>(null);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/company/invites', { cache: 'no-store' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(invitationErrorMessage(errorCode(envelope)));
      setInvitations(companyInviteListResponseSchema.parse(envelope.data).data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Non è stato possibile caricare gli inviti.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pendingInvitations = useMemo(() => invitations.filter((invitation) => invitation.status === 'pending'), [invitations]);
  const completedInvitations = useMemo(() => invitations.filter((invitation) => invitation.status !== 'pending'), [invitations]);

  async function copyLink() {
    if (!latestLink) return;
    try {
      await navigator.clipboard.writeText(latestLink);
      setNotice('Link invito copiato negli appunti.');
    } catch {
      setNotice('Copia manualmente il link mostrato qui sotto.');
    }
  }

  async function createInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    setLatestLink(null);
    try {
      const response = await fetch('/api/backend/company/invites', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(invitationErrorMessage(errorCode(envelope)));
      const data = envelope.data as { acceptLink?: unknown };
      if (typeof data.acceptLink !== 'string') throw new Error('Il link invito non è disponibile. Riprova.');
      setLatestLink(data.acceptLink);
      setEmail('');
      setNotice('Invito medico creato. Copia il link ora: non viene conservato nel database.');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Non è stato possibile creare l’invito.');
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeInvitation(invitationId: string) {
    if (mutating) return;
    setMutating(true);
    setError(null);
    try {
      const response = await fetch(`/api/backend/company/invites/${encodeURIComponent(invitationId)}`, { method: 'DELETE' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(invitationErrorMessage(errorCode(envelope)));
      setActionId(null);
      setNotice('Invito revocato. Il link non è più utilizzabile.');
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Non è stato possibile revocare l’invito.');
    } finally {
      setMutating(false);
    }
  }

  async function rotateInvitationLink(invitationId: string) {
    if (mutating) return;
    setMutating(true);
    setError(null);
    setLatestLink(null);
    try {
      const response = await fetch(`/api/backend/company/invites/${encodeURIComponent(invitationId)}/resend`, { method: 'POST' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(invitationErrorMessage(errorCode(envelope)));
      const data = envelope.data as { acceptLink?: unknown };
      if (typeof data.acceptLink !== 'string') throw new Error('Il nuovo link non è disponibile. Riprova.');
      setLatestLink(data.acceptLink);
      setActionId(null);
      setNotice('Nuovo link medico generato. Il precedente è stato invalidato.');
      await load();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Non è stato possibile generare un nuovo link.');
    } finally {
      setMutating(false);
    }
  }

  async function confirmHistoryAction() {
    if (!historyDialog || mutating) return;
    setMutating(true);
    setError(null);
    try {
      const endpoint = historyDialog.kind === 'clear'
        ? '/api/backend/company/invites/history/clear'
        : `/api/backend/company/invites/${encodeURIComponent(historyDialog.invitation.id)}/history`;
      const response = await fetch(endpoint, { method: historyDialog.kind === 'clear' ? 'POST' : 'DELETE' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(invitationErrorMessage(errorCode(envelope)));
      const hiddenCount = historyDialog.kind === 'clear' && typeof (envelope.data as { hiddenCount?: unknown } | undefined)?.hiddenCount === 'number'
        ? (envelope.data as { hiddenCount: number }).hiddenCount
        : null;
      setHistoryDialog(null);
      setActionId(null);
      setNotice(hiddenCount === null ? 'Invito rimosso dalla cronologia.' : `${hiddenCount} inviti conclusi rimossi dalla cronologia.`);
      await load();
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Non è stato possibile aggiornare la cronologia.');
    } finally {
      setMutating(false);
    }
  }

  return (
    <section className={styles.content} aria-labelledby="organization-invitations-title">
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Struttura</p>
        <h1 id="organization-invitations-title">Inviti</h1>
        <p>Invita un medico a collaborare con la struttura.</p>
      </header>

      <form className={styles.composer} onSubmit={createInvitation}>
        <label htmlFor="medical-invitation-email">Email del medico</label>
        <div>
          <input id="medical-invitation-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="medico@example.com" required disabled={submitting || loading} />
          <button type="submit" disabled={submitting || loading}>{submitting ? 'Invio…' : 'Invia invito'}</button>
        </div>
      </form>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {latestLink ? <section className={styles.linkPanel} aria-label="Link invito medico appena generato"><label htmlFor="latest-invitation-link">Link invito</label><div><input id="latest-invitation-link" value={latestLink} readOnly /><button type="button" onClick={() => void copyLink()}>Copia link</button></div></section> : null}

      <section className={styles.invitationSection} aria-labelledby="pending-invitations-title">
        <div className={styles.sectionHeading}><h2 id="pending-invitations-title">Inviti in attesa</h2><span>{pendingInvitations.length}</span></div>
        {loading ? <p className={styles.empty}>Caricamento inviti…</p> : null}
        {!loading && pendingInvitations.length === 0 ? <p className={styles.empty}>Nessun invito in attesa.</p> : null}
        {!loading && pendingInvitations.length > 0 ? <ul className={styles.list}>{pendingInvitations.map((invitation) => <li className={styles.invitation} key={invitation.id}><div className={styles.identity}><strong>{invitation.email}</strong><span>Medico · Scade il {formatDate(invitation.expiresAt)}</span></div><div className={styles.actionArea}><button aria-expanded={actionId === invitation.id} aria-haspopup="menu" aria-label={`Azioni per ${invitation.email}`} className={styles.menuTrigger} onClick={() => setActionId((current) => current === invitation.id ? null : invitation.id)} type="button">•••</button>{actionId === invitation.id ? <div className={styles.menu} role="menu"><button disabled={mutating} onClick={() => void rotateInvitationLink(invitation.id)} role="menuitem" type="button">Genera nuovo link</button><button disabled={mutating} onClick={() => void revokeInvitation(invitation.id)} role="menuitem" type="button">Revoca invito</button></div> : null}</div></li>)}</ul> : null}
      </section>

      <section className={styles.invitationSection} aria-labelledby="invitation-history-title">
        <div className={styles.sectionHeading}><h2 id="invitation-history-title">Cronologia</h2>{completedInvitations.length > 0 ? <button className={styles.historyClear} onClick={() => setHistoryDialog({ kind: 'clear' })} type="button">Pulisci cronologia</button> : null}</div>
        {!loading && completedInvitations.length === 0 ? <p className={styles.empty}>Nessun invito concluso da mostrare.</p> : null}
        {!loading && completedInvitations.length > 0 ? <ul className={styles.list}>{completedInvitations.map((invitation) => <li className={styles.invitation} key={invitation.id}><div className={styles.identity}><strong>{invitation.email}</strong><span>Medico · {statusLabel(invitation.status)} · Creato il {formatDate(invitation.createdAt)}</span></div><div className={styles.actionArea}><button aria-expanded={actionId === invitation.id} aria-haspopup="menu" aria-label={`Azioni per ${invitation.email}`} className={styles.menuTrigger} onClick={() => setActionId((current) => current === invitation.id ? null : invitation.id)} type="button">•••</button>{actionId === invitation.id ? <div className={styles.menu} role="menu"><button disabled={mutating} onClick={() => setHistoryDialog({ kind: 'hide', invitation })} role="menuitem" type="button">Rimuovi dalla cronologia</button></div> : null}</div></li>)}</ul> : null}
      </section>

      {historyDialog ? <div className={styles.dialogBackdrop} role="presentation"><section aria-modal="true" className={styles.dialog} role="dialog"><p className={styles.eyebrow}>Conferma</p><h2>{historyDialog.kind === 'clear' ? 'Rimuovere gli inviti conclusi dalla cronologia?' : `Rimuovere l’invito per ${historyDialog.invitation.email} dalla cronologia?`}</h2><p>{historyDialog.kind === 'clear' ? 'Gli inviti accettati, revocati o scaduti non saranno più visualizzati. Gli inviti in attesa resteranno invariati.' : 'L’invito resterà conservato per audit, ma non verrà più visualizzato in questa pagina.'}</p><div className={styles.dialogActions}><button disabled={mutating} onClick={() => setHistoryDialog(null)} type="button">Annulla</button><button disabled={mutating} onClick={() => void confirmHistoryAction()} type="button">{mutating ? 'Aggiornamento…' : historyDialog.kind === 'clear' ? 'Pulisci cronologia' : 'Rimuovi'}</button></div></section></div> : null}
    </section>
  );
}
