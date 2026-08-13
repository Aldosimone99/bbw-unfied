'use client';

import {
  companyInviteListResponseSchema,
  organizationInvitationRoleSchema,
  type CompanyInviteRow,
  type OrganizationInvitationRole,
} from '@bbw/interfaces';
import { useCallback, useEffect, useMemo, useState } from 'react';

import styles from './OrganizationInvitations.module.css';

type ApiFailure = { code?: string };
type ApiEnvelope = { success?: boolean; data?: unknown; code?: unknown };

function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const code = (payload as ApiFailure).code;
  return typeof code === 'string' ? code : null;
}

async function readEnvelope(response: Response): Promise<ApiEnvelope> {
  return response.json() as Promise<ApiEnvelope>;
}

function invitationErrorMessage(code: string | null): string {
  const messages: Record<string, string> = {
    FORBIDDEN: 'Non hai i permessi necessari per gestire gli inviti in questo contesto.',
    INVITATION_ROLE_NOT_ASSIGNABLE: 'Non puoi assegnare il ruolo selezionato.',
    INVITATION_ALREADY_PENDING: 'Esiste già un invito in attesa per questo indirizzo email.',
    INVITATION_NOT_FOUND: 'L’invito non è più disponibile.',
    INVITATION_NOT_PENDING: 'Questo invito non può più essere modificato.',
  };
  return code ? messages[code] ?? 'Non è stato possibile completare l’operazione.' : 'Non è stato possibile completare l’operazione.';
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

export default function OrganizationInvitations({ organizationName }: Readonly<{ organizationName: string }>) {
  const [roles, setRoles] = useState<OrganizationInvitationRole[]>([]);
  const [invitations, setInvitations] = useState<CompanyInviteRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [email, setEmail] = useState('');
  const [latestLink, setLatestLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesResponse, invitationsResponse] = await Promise.all([
        fetch('/api/backend/company/invites/assignable-roles', { cache: 'no-store' }),
        fetch('/api/backend/company/invites', { cache: 'no-store' }),
      ]);
      const [rolesEnvelope, invitationsEnvelope] = await Promise.all([
        readEnvelope(rolesResponse),
        readEnvelope(invitationsResponse),
      ]);
      if (!rolesResponse.ok || !rolesEnvelope.success) throw new Error(invitationErrorMessage(errorCode(rolesEnvelope)));
      if (!invitationsResponse.ok || !invitationsEnvelope.success) throw new Error(invitationErrorMessage(errorCode(invitationsEnvelope)));

      const availableRoles = organizationInvitationRoleSchema.array().parse(rolesEnvelope.data);
      const invitationList = companyInviteListResponseSchema.parse(invitationsEnvelope.data);
      setRoles(availableRoles);
      setInvitations(invitationList.data);
      setSelectedRoleId((current) => availableRoles.some((role) => role.id === current) ? current : availableRoles[0]?.id ?? '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Non è stato possibile caricare gli inviti.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

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
    if (!selectedRole) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);
    setLatestLink(null);
    try {
      const response = await fetch('/api/backend/company/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, roleId: selectedRole.id }),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(invitationErrorMessage(errorCode(envelope)));
      const data = envelope.data as { acceptLink?: unknown };
      if (typeof data.acceptLink !== 'string') throw new Error('Il link invito non è disponibile. Riprova.');

      setLatestLink(data.acceptLink);
      setEmail('');
      setNotice(`Invito creato per il ruolo ${selectedRole.displayName}. Copia il link ora: non viene conservato nel database.`);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Non è stato possibile creare l’invito.');
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeInvitation(invitationId: string) {
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/company/invites/${encodeURIComponent(invitationId)}`, { method: 'DELETE' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(invitationErrorMessage(errorCode(envelope)));
      setRevokingId(null);
      setNotice('Invito revocato. Il link non è più utilizzabile.');
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Non è stato possibile revocare l’invito.');
    }
  }

  async function rotateInvitationLink(invitationId: string) {
    setError(null);
    setNotice(null);
    setLatestLink(null);
    try {
      const response = await fetch(`/api/backend/company/invites/${encodeURIComponent(invitationId)}/resend`, { method: 'POST' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(invitationErrorMessage(errorCode(envelope)));
      const data = envelope.data as { acceptLink?: unknown };
      if (typeof data.acceptLink !== 'string') throw new Error('Il nuovo link non è disponibile. Riprova.');
      setLatestLink(data.acceptLink);
      setNotice('È stato generato un nuovo link. Il precedente è stato invalidato e non viene inviata alcuna email.');
      await load();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Non è stato possibile generare un nuovo link.');
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="organization-invitations-title">
        <p className={styles.eyebrow}>{organizationName}</p>
        <h1 id="organization-invitations-title">Invita un membro</h1>
        <p className={styles.intro}>Crea un link monouso per un nuovo membro dell’organizzazione. Il ruolo viene verificato dal server prima della creazione.</p>

        <form className={styles.form} onSubmit={createInvitation}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="medico@example.com"
              required
              disabled={submitting || loading || roles.length === 0}
            />
          </label>
          <label>
            <span>Ruolo</span>
            <select
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              disabled={submitting || loading || roles.length === 0}
            >
              {roles.map((role) => <option value={role.id} key={role.id}>{role.displayName}</option>)}
            </select>
          </label>
          <button type="submit" disabled={submitting || loading || !selectedRole}>
            {submitting ? 'Creazione…' : 'Crea invito'}
          </button>
        </form>

        {roles.length === 0 && !loading ? <p className={styles.warning}>Non hai ruoli assegnabili in questo contesto.</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        {latestLink ? (
          <section className={styles.linkPanel} aria-label="Link invito appena generato">
            <label htmlFor="latest-invitation-link">Link invito</label>
            <div>
              <input id="latest-invitation-link" value={latestLink} readOnly />
              <button type="button" onClick={() => void copyLink()}>Copia link</button>
            </div>
          </section>
        ) : null}

        <section className={styles.list} aria-labelledby="organization-invitations-list-title">
          <div className={styles.listHeading}>
            <h2 id="organization-invitations-list-title">Inviti esistenti</h2>
            <button type="button" onClick={() => void load()} disabled={loading}>Aggiorna</button>
          </div>
          {loading ? <p>Caricamento inviti…</p> : null}
          {!loading && invitations.length === 0 ? <p>Nessun invito creato in questo contesto.</p> : null}
          {!loading && invitations.length > 0 ? (
            <ul>
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <span>{invitation.role.displayName}</span>
                    <span>Stato: {invitation.status}</span>
                    <span>Scade: {formatDate(invitation.expiresAt)}</span>
                  </div>
                  {invitation.status === 'pending' ? (
                    <div className={styles.actions}>
                      <button type="button" onClick={() => void rotateInvitationLink(invitation.id)}>Genera nuovo link</button>
                      {revokingId === invitation.id ? (
                        <span className={styles.confirmation}>
                          Revocare questo invito?
                          <button type="button" onClick={() => void revokeInvitation(invitation.id)}>Conferma revoca</button>
                          <button type="button" onClick={() => setRevokingId(null)}>Annulla</button>
                        </span>
                      ) : <button type="button" onClick={() => setRevokingId(invitation.id)}>Revoca</button>}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </section>
    </main>
  );
}
