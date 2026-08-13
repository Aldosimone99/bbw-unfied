"use client";

import type { OperationalContext } from '@bbw/interfaces';
import { useActionState } from 'react';

import PlatformIcon from '../dashboard/PlatformIcon';
import { setOperationalContextAction, type SetOperationalContextActionState } from './actions';
import {
  getOperationalContextDescription,
  getOperationalContextId,
  getOperationalContextRoleLabel,
  getOperationalContextTypeLabel,
} from './labels';
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
      <div className={styles.cardHeader}>
        <div className={styles.iconFrame}>
          <PlatformIcon name={context.kind === 'organization' ? 'organization' : 'professionals'} size={20} />
        </div>
        <p className={styles.type}>{getOperationalContextTypeLabel(context)}</p>
      </div>
      <h2>{context.label}</h2>
      {roleLabel ? <span className={styles.roleBadge}>{roleLabel}</span> : null}
      <p className={styles.description}>{getOperationalContextDescription(context)}</p>
      <button className={styles.cardAction} type="submit" disabled={pending}>
        <span>{pending ? 'Accesso…' : 'Entra'}</span>
        {!pending ? <PlatformIcon name="arrowRight" size={18} /> : null}
      </button>
      {state.status === 'error' ? <p className={styles.error} role="alert">{state.message}</p> : null}
    </form>
  );
}
