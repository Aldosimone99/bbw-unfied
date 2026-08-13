'use client';

import { organizationMemberSchema, type OrganizationMember } from '@bbw/interfaces';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import PlatformIcon from '../dashboard/PlatformIcon';
import {
  OrganizationEmptyState,
  OrganizationLoadingState,
  OrganizationPageHeader,
  OrganizationPageShell,
  OrganizationSectionHeader,
  StatusBadge,
} from '../organizations/OrganizationPagePrimitives';
import {
  getMemberRoleLabel,
  getMemberStatusLabel,
  getMemberStatusTone,
} from '../organizations/organizationPresentation';

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
    FORBIDDEN: 'Non hai i permessi necessari per gestire lo staff di questa struttura.',
    ORGANIZATION_MEMBER_SELF_REMOVAL_NOT_ALLOWED: 'Non puoi rimuovere te stesso da questo pannello.',
    ORGANIZATION_LAST_OWNER_REMOVAL_NOT_ALLOWED: 'Non puoi rimuovere l’ultimo responsabile della struttura.',
    ORGANIZATION_MEMBER_NOT_ACTIVE: 'Questa persona non è più attiva.',
  };
  return code ? messages[code] ?? 'Non è stato possibile completare l’operazione.' : 'Non è stato possibile completare l’operazione.';
}

function memberName(member: OrganizationMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;
}

function memberInitials(member: OrganizationMember): string {
  const nameParts = [member.firstName, member.lastName].filter(Boolean) as string[];
  if (nameParts.length > 0) return nameParts.map((part) => part[0]?.toUpperCase()).join('').slice(0, 2);
  return member.email.slice(0, 2).toUpperCase();
}

export default function OrganizationMembers({
  canManage,
  canInvite,
}: Readonly<{ canManage: boolean; canInvite: boolean }>) {
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

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('it');
    if (!normalizedQuery) return members;
    return members.filter((member) => {
      const roleLabel = getMemberRoleLabel(member.roles, member.isOrganizationOwner);
      return `${memberName(member)} ${member.email} ${roleLabel}`
        .toLocaleLowerCase('it')
        .includes(normalizedQuery);
    });
  }, [members, query]);

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
      setNotice(`${memberName(removalTarget)} non fa più parte dello staff.`);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Non è stato possibile rimuovere il membro.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <OrganizationPageShell>
      <OrganizationPageHeader
        title="Staff"
        description="Gestisci le persone che collaborano con la struttura."
      />

      <section className={styles.membersSection} aria-labelledby="organization-members-list-title">
        <OrganizationSectionHeader id="organization-members-list-title" title="Staff della struttura" count={members.length} />
        <div className={styles.toolbar}>
          <label className={styles.searchField} htmlFor="member-search">
            <PlatformIcon name="search" size={18} />
            <span className={styles.srOnly}>Cerca per nome o email</span>
            <input
              id="member-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca per nome o email"
              type="search"
            />
          </label>
          {canInvite ? <Link className={styles.inviteLink} href="/inviti">Invita persona <PlatformIcon name="arrowRight" size={18} /></Link> : null}
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        {loading ? <OrganizationLoadingState label="Caricamento staff…" /> : null}
        {!loading && members.length === 0 ? (
          <OrganizationEmptyState
            icon="members"
            title="Lo staff è ancora vuoto."
            description="Invita un professionista per iniziare a collaborare nella struttura."
            action={canInvite ? <Link className={styles.emptyLink} href="/inviti">Invita persona <PlatformIcon name="arrowRight" size={18} /></Link> : null}
          />
        ) : null}
        {!loading && members.length > 0 && visibleMembers.length === 0 ? (
          <OrganizationEmptyState
            icon="search"
            title="Nessuna persona corrisponde alla ricerca."
            description="Prova a cercare con un altro nome o indirizzo email."
          />
        ) : null}
        {!loading && visibleMembers.length > 0 ? (
          <ul className={styles.list} aria-label="Staff della struttura">
            {visibleMembers.map((member) => {
              const canRemove = canManage && member.status === 'active' && !member.isOrganizationOwner;
              return (
                <li className={styles.memberRow} key={member.membershipId}>
                  <span className={styles.avatar} aria-hidden="true">{memberInitials(member)}</span>
                  <div className={styles.identity}>
                    <strong>{memberName(member)}</strong>
                    <span>{member.email}</span>
                  </div>
                  <div className={styles.memberMeta}>
                    <span>{getMemberRoleLabel(member.roles, member.isOrganizationOwner)}</span>
                    <StatusBadge label={getMemberStatusLabel(member.status)} tone={getMemberStatusTone(member.status)} />
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
                      >
                        <PlatformIcon name="moreActions" size={18} />
                      </button>
                      {actionMenuId === member.membershipId ? (
                        <div className={styles.menu} role="menu">
                          <button onClick={() => setRemovalTarget(member)} role="menuitem" type="button">Rimuovi dallo staff</button>
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
            <p className={styles.cardEyebrow}>Conferma</p>
            <h2 id="remove-member-title">Rimuovere {memberName(removalTarget)} dallo staff?</h2>
            <p id="remove-member-description">La persona perderà l’accesso alle funzionalità associate allo staff.</p>
            <div className={styles.dialogActions}>
              <button disabled={Boolean(removingId)} onClick={() => setRemovalTarget(null)} type="button">Annulla</button>
              <button disabled={Boolean(removingId)} onClick={() => void removeMember()} type="button">
                {removingId ? 'Rimozione…' : 'Rimuovi'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </OrganizationPageShell>
  );
}
