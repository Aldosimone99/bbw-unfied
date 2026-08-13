"use client";

import type { OperationalContext } from '@bbw/interfaces';
import { useActionState } from 'react';

import { setOperationalContextAction, type SetOperationalContextActionState } from './actions';
import { getOperationalContextId, getOperationalContextRoleLabel, getOperationalContextTypeLabel } from './labels';
import styles from './ContextSelection.module.css';

const initialState: SetOperationalContextActionState = { status: 'idle' };

type OperationalContextCardProps = {
  context: OperationalContext;
  nextDestination: string;
};

export default function OperationalContextCard({ context, nextDestination }: OperationalContextCardProps) {
  const [state, formAction, pending] = useActionState(setOperationalContextAction, initialState);
  const roleLabel = getOperationalContextRoleLabel(context);

  return (
    <form className={styles.card} action={formAction}>
      <input type="hidden" name="contextKind" value={context.kind} />
      <input type="hidden" name="contextId" value={getOperationalContextId(context)} />
      <input type="hidden" name="nextDestination" value={nextDestination} />
      <p className={styles.type}>{getOperationalContextTypeLabel(context)}</p>
      <h2>{context.label}</h2>
      {roleLabel ? <p className={styles.role}>{roleLabel}</p> : <p className={styles.role}>Contesto operativo personale</p>}
      <button type="submit" disabled={pending}>{pending ? 'Accesso…' : 'Entra'}</button>
      {state.status === 'error' ? <p className={styles.error} role="alert">{state.message}</p> : null}
    </form>
  );
}
