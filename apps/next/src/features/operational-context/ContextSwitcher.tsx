"use client";

import type { OperationalContext } from '@bbw/interfaces';
import { useActionState, useState } from 'react';

import { setOperationalContextAction, type SetOperationalContextActionState } from './actions';
import {
  getOperationalContextId,
  getOperationalContextKey,
  getOperationalContextRoleLabel,
  getOperationalContextTypeLabel,
} from './labels';
import styles from '../dashboard/Dashboard.module.css';

type ContextSwitcherProps = {
  contexts: OperationalContext[];
  activeContext: OperationalContext | null;
};

const initialState: SetOperationalContextActionState = { status: 'idle' };

export default function ContextSwitcher({ contexts, activeContext }: ContextSwitcherProps) {
  const [state, formAction, pending] = useActionState(setOperationalContextAction, initialState);
  const [selectedKey, setSelectedKey] = useState(
    activeContext ? getOperationalContextKey(activeContext) : contexts[0] ? getOperationalContextKey(contexts[0]) : '',
  );
  const selectedContext = contexts.find((context) => getOperationalContextKey(context) === selectedKey) ?? contexts[0] ?? null;

  if (contexts.length === 0) {
    return (
      <div className={styles.contextSwitcherEmpty} aria-label="Spazio di lavoro">
        <span className={styles.contextSwitcherLabel}>Spazio di lavoro</span>
        <strong>Nessun contesto operativo disponibile</strong>
      </div>
    );
  }

  if (contexts.length === 1) {
    const context = contexts[0]!;
    const roleLabel = getOperationalContextRoleLabel(context);
    return (
      <div className={styles.contextSwitcherSingle} aria-label="Spazio di lavoro attivo">
        <span className={styles.contextSwitcherLabel}>{getOperationalContextTypeLabel(context)}</span>
        <strong>{context.label}</strong>
        {roleLabel ? <small>{roleLabel}</small> : null}
      </div>
    );
  }

  return (
    <form className={styles.contextSwitcher} action={formAction}>
      <label className={styles.contextSwitcherLabel} htmlFor="active-operational-context">Spazio di lavoro</label>
      <input type="hidden" name="contextKind" value={selectedContext?.kind ?? ''} readOnly />
      <input type="hidden" name="contextId" value={selectedContext ? getOperationalContextId(selectedContext) : ''} readOnly />
      <div className={styles.contextSwitcherControls}>
        <select
          id="active-operational-context"
          value={selectedKey}
          onChange={(event) => setSelectedKey(event.target.value)}
          disabled={pending}
        >
          {contexts.map((context) => {
            const roleLabel = getOperationalContextRoleLabel(context);
            return (
              <option value={getOperationalContextKey(context)} key={getOperationalContextKey(context)}>
                {context.label} · {getOperationalContextTypeLabel(context)}{roleLabel ? ` · ${roleLabel}` : ''}
              </option>
            );
          })}
        </select>
        <button type="submit" disabled={pending}>{pending ? 'Cambio…' : 'Cambia spazio'}</button>
      </div>
      {state.status === 'error' ? <p className={styles.contextSwitcherError} role="alert">{state.message}</p> : null}
    </form>
  );
}
