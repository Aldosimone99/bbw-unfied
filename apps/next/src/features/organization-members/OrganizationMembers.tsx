'use client';

import { organizationMemberSchema, type OrganizationMember } from '@bbw/interfaces';
import { useCallback, useEffect, useMemo, useState } from 'react';

import styles from './OrganizationMembers.module.css';

type ApiEnvelope = { success?: boolean; data?: unknown; code?: unknown };

function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

async function readEnvelope(response: Response): Promise<ApiEnvelope> {
  return response.json() as Promise<ApiEnvelope>;
}

function memberErrorMessage(code: string | null): string {
  const messages: Record<string, string> = {
    FORBIDDEN: 'Non hai i permessi necessari per gestire i membri di questa struttura.',
    ORGANIZATION_MEMBER_SELF_REMOVAL_NOT_ALLOWED: 'Non puoi rimuovere te stesso da questo pannello.',
    ORGANIZATION_LAST_OWNER_REMOVAL_NOT_ALLOWED: 'Non puoi rimuovere l’ultimo owner della struttura.',
    ORGANIZATION_MEMBER_NOT_ACTIVE: 'Questo membro non è più attivo.',
  };
  return code ? messages[code] ?? 'Non è stato possibile completare l’operazione.' : 'Non è stato possibile completare l’operazione.';
}

function memberName(member: OrganizationMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;
}

export default function OrganizationMembers({ organizationName, canManage }: Readonly<{ organizationName: string; canManage: boolean }>) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<OrganizationMember | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/organization/members', { cache: 'no-store' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(memberErrorMessage(errorCode(envelope)));
      setMembers(organizationMemberSchema.array().parse(envelope.data));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Non è stato possibile caricare i membri.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const activeMembers = useMemo(() => members.filter((member) => member.status === 'active'), [members]);
  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('it');
    if (!normalizedQuery) return activeMembers;
    return activeMembers.filter((member) => (
      `${memberName(member)} ${member.email} ${member.roles.map((role) => role.displayName).join(' ')}`
        .toLocaleLowerCase('it')
        .includes(normalizedQuery)
    ));
  }, [activeMembers, query]);

  async function removeMember() {
    if (!removalTarget || removingId) return;
    setRemovingId(removalTarget.membershipId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/organization/members/${encodeURIComponent(removalTarget.membershipId)}`, { method: 'DELETE' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(memberErrorMessage(errorCode(envelope)));
      setRemovalTarget(null);
      setActionMenuId(null);
      setNotice(`${memberName(removalTarget)} non fa più parte della struttura.`);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Non è stato possibile rimuovere il membro.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className={styles.content} aria-labelledby="organization-members-title">
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Struttura</p>
        <h1 id="organization-members-title">Membri</h1>
        <p>Gestisci i professionisti che fanno parte della struttura.</p>
      </header>

      <section className={styles.membersSection} aria-labelledby="active-members-title">
        <div className={styles.sectionHeading}>
          <h2 id="active-members-title">Membri attivi</h2>
          <span aria-label={`${activeMembers.length} membri attivi`}>{activeMembers.length}</span>
        </div>
        <label className={styles.search} htmlFor="member-search">
          <input
            aria-label="Cerca per nome o email"
            id="member-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca per nome o email"
            type="search"
          />
        </label>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        {loading ? <p className={styles.empty}>Caricamento membri…</p> : null}
        {!loading && visibleMembers.length === 0 ? <p className={styles.empty}>Nessun membro attivo corrisponde alla ricerca.</p> : null}
        {!loading && visibleMembers.length > 0 ? (
          <ul className={styles.list} aria-label="Membri attivi della struttura">
            {visibleMembers.map((member) => {
              const canRemove = canManage && !member.isOrganizationOwner;
              const roleLabel = member.roles.map((role) => role.displayName).join(', ') || 'Professionista';
              return (
                <li className={styles.member} key={member.membershipId}>
                  <div className={styles.identity}>
                    <strong>{memberName(member)}</strong>
                    <span>{member.email}</span>
                  </div>
                  <div className={styles.memberMeta}>
                    <span>{roleLabel}</span>
                    <span className={styles.status}>Attivo</span>
                  </div>
                  {canRemove ? (
                    <div className={styles.actionArea}>
                      <button
                        aria-expanded={actionMenuId === member.membershipId}
                        aria-haspopup="menu"
                        aria-label={`Azioni per ${memberName(member)}`}
                        className={styles.menuTrigger}
                        onClick={() => setActionMenuId((current) => current === member.membershipId ? null : member.membershipId)}
                        type="button"
                      >•••</button>
                      {actionMenuId === member.membershipId ? (
                        <div className={styles.menu} role="menu">
                          <button onClick={() => setRemovalTarget(member)} role="menuitem" type="button">Rimuovi dalla struttura</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {removalTarget ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <section aria-describedby="remove-member-description" aria-labelledby="remove-member-title" aria-modal="true" className={styles.dialog} role="dialog">
            <p className={styles.eyebrow}>Conferma</p>
            <h2 id="remove-member-title">Rimuovere {memberName(removalTarget)} dalla struttura?</h2>
            <p id="remove-member-description">Il professionista perderà l’accesso alla clinica e alle funzionalità associate.</p>
            <div className={styles.dialogActions}>
              <button disabled={Boolean(removingId)} onClick={() => setRemovalTarget(null)} type="button">Annulla</button>
              <button disabled={Boolean(removingId)} onClick={() => void removeMember()} type="button">
                {removingId ? 'Rimozione…' : 'Rimuovi'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
