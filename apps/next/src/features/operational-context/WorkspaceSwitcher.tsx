'use client';

import type { OperationalContext } from '@bbw/interfaces';
import { createPortal } from 'react-dom';
import { useActionState, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import PlatformIcon from '../dashboard/PlatformIcon';
import { setOperationalContextAction, type SetOperationalContextActionState } from './actions';
import {
  getOperationalContextId,
  getOperationalContextKey,
  getOperationalContextTypeLabel,
  getOperationalContextUserRoleLabel,
} from './labels';

import styles from './WorkspaceSwitcher.module.css';

type WorkspaceSwitcherProps = {
  contexts: OperationalContext[];
  activeContext: OperationalContext | null;
  canManageOrganization?: boolean;
};

type PopoverPosition = {
  top: number;
  left: number;
  width: number;
  mobile: boolean;
};

const initialState: SetOperationalContextActionState = { status: 'idle' };
const menuId = 'workspace-switcher-menu';

function WorkspaceIdentity({ context }: Readonly<{ context: OperationalContext }>) {
  const isOrganization = context.kind === 'organization';
  const roleLabel = getOperationalContextUserRoleLabel(context);

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
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeKey = activeContext ? getOperationalContextKey(activeContext) : null;

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPopoverPosition(null);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleDocumentInteraction(event: PointerEvent) {
      const target = event.target as Node;
      if (!switcherRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        closeMenu(true);
      }
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    }

    document.addEventListener('pointerdown', handleDocumentInteraction);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentInteraction);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => itemRefs.current[0]?.focus());
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const triggerRect = trigger.getBoundingClientRect();
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      const width = Math.min(mobile ? 420 : 330, Math.max(0, viewportWidth - 32));
      const left = mobile
        ? Math.max(16, (viewportWidth - width) / 2)
        : Math.min(Math.max(16, triggerRect.left), Math.max(16, viewportWidth - width - 16));
      const height = popover.offsetHeight;
      let top = triggerRect.top - height - 10;

      if (mobile || top < 16) top = triggerRect.bottom + 10;
      if (top + height > viewportHeight - 16) top = Math.max(16, viewportHeight - height - 16);

      setPopoverPosition({ top, left, width, mobile });
    }

    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [canManageOrganization, contexts.length, open, pending, state.status]);

  function handleItemKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? contexts.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + contexts.length) % contexts.length;
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

  const popover = open ? (
    <div
      aria-label="Spazi di lavoro"
      className={styles.popover}
      data-mobile={popoverPosition?.mobile ? 'true' : 'false'}
      data-ready={popoverPosition ? 'true' : 'false'}
      id={menuId}
      ref={popoverRef}
      role="menu"
      style={popoverPosition ? {
        left: popoverPosition.left,
        top: popoverPosition.top,
        width: popoverPosition.width,
      } : undefined}
    >
      <div className={styles.popoverSurface}>
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
          <a className={styles.manageLink} href="/organizzazione" onClick={() => closeMenu(false)}>
            Gestisci spazi
          </a>
        </>
      ) : null}
      {pending ? <p className={styles.pendingMessage} role="status" aria-live="polite">Cambio spazio in corso…</p> : null}
      {state.status === 'error' ? <p className={styles.error} role="alert">{state.message}</p> : null}
        </div>
      </div>
  ) : null;

  return (
    <div className={styles.switcher} ref={switcherRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        className={styles.trigger}
        onClick={() => (open ? closeMenu(true) : setOpen(true))}
        ref={triggerRef}
        type="button"
      >
        <span className={styles.switcherLabel}>Spazio attivo</span>
        <span className={styles.workspaceRow}>
          <WorkspaceIdentity context={activeContext} />
          <PlatformIcon name="chevronDown" className={styles.chevron} size={18} />
        </span>
      </button>
      {typeof document !== 'undefined' && popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
