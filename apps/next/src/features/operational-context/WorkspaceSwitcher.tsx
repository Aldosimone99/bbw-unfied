'use client';

import type { OperationalContext } from '@bbw/interfaces';
import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import PlatformIcon from '../dashboard/PlatformIcon';
import { setOperationalContextAction, type SetOperationalContextActionState } from './actions';
import {
  getOperationalContextId,
  getOperationalContextKey,
  getOperationalContextRoleLabel,
  getOperationalContextTypeLabel,
} from './labels';

import styles from './WorkspaceSwitcher.module.css';

type WorkspaceSwitcherProps = {
  contexts: OperationalContext[];
  activeContext: OperationalContext | null;
  canManageOrganization?: boolean;
};

const initialState: SetOperationalContextActionState = { status: 'idle' };

function getWorkspaceRoleLabel(context: OperationalContext): string | null {
  return getOperationalContextRoleLabel(context)
    ?? (context.kind === 'personal_professional' ? context.professionalTypeDisplayName : null);
}

function WorkspaceIdentity({ context }: Readonly<{ context: OperationalContext }>) {
  const isOrganization = context.kind === 'organization';
  const roleLabel = getWorkspaceRoleLabel(context);

  return (
    <>
      <span className={styles.workspaceIcon}>
        <PlatformIcon name={isOrganization ? 'organization' : 'professionals'} size={18} />
      </span>
      <span className={styles.workspaceCopy}>
        <strong>{context.label}</strong>
        <small>
          {getOperationalContextTypeLabel(context)}
          {roleLabel ? ` · ${roleLabel}` : ''}
        </small>
      </span>
    </>
  );
}

export default function WorkspaceSwitcher({
  contexts,
  activeContext,
  canManageOrganization = false,
}: WorkspaceSwitcherProps) {
  const [state, formAction, pending] = useActionState(setOperationalContextAction, initialState);
  const [open, setOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = 'workspace-switcher-menu';
  const activeKey = activeContext ? getOperationalContextKey(activeContext) : null;

  useEffect(() => {
    if (!open) return;

    function handleDocumentInteraction(event: PointerEvent) {
      if (!switcherRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', handleDocumentInteraction);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentInteraction);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [open]);

  function handleItemKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (index + direction + contexts.length) % contexts.length;
    itemRefs.current[nextIndex]?.focus();
  }

  if (!activeContext) {
    return (
      <div className={styles.emptyState} aria-label="Spazio attivo">
        <span className={styles.switcherLabel}>Spazio attivo</span>
        <strong>Nessuno spazio selezionato</strong>
      </div>
    );
  }

  if (contexts.length <= 1) {
    return (
      <div className={styles.staticState} aria-label="Spazio attivo">
        <span className={styles.switcherLabel}>Spazio attivo</span>
        <span className={styles.workspaceRow}>
          <WorkspaceIdentity context={activeContext} />
        </span>
      </div>
    );
  }

  return (
    <div className={styles.switcher} ref={switcherRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={styles.switcherLabel}>Spazio attivo</span>
        <span className={styles.workspaceRow}>
          <WorkspaceIdentity context={activeContext} />
          <PlatformIcon name="chevronsUpDown" className={styles.chevron} size={18} />
        </span>
      </button>

      {open ? (
        <div className={styles.popover} id={menuId} role="menu" aria-label="Spazi di lavoro">
          <p className={styles.popoverTitle}>Spazi di lavoro</p>
          <div className={styles.workspaceList}>
            {contexts.map((context, index) => {
              const key = getOperationalContextKey(context);
              const isActive = key === activeKey;
              return (
                <form action={formAction} className={styles.workspaceForm} key={key}>
                  <input type="hidden" name="contextKind" value={context.kind} />
                  <input type="hidden" name="contextId" value={getOperationalContextId(context)} />
                  <button
                    aria-checked={isActive}
                    className={styles.workspaceOption}
                    disabled={pending}
                    onKeyDown={(event) => handleItemKeyDown(event, index)}
                    ref={(element) => { itemRefs.current[index] = element; }}
                    role="menuitemradio"
                    type="submit"
                  >
                    <span className={styles.workspaceOptionIdentity}>
                      <WorkspaceIdentity context={context} />
                    </span>
                    <span className={styles.checkmark} aria-hidden="true">
                      {isActive ? <PlatformIcon name="check" size={17} /> : null}
                    </span>
                  </button>
                </form>
              );
            })}
          </div>
          {canManageOrganization ? (
            <>
              <div className={styles.separator} />
              <a className={styles.manageLink} href="/organizzazione" onClick={() => setOpen(false)}>
                Gestisci struttura
              </a>
            </>
          ) : null}
          {state.status === 'error' ? <p className={styles.error} role="alert">{state.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
