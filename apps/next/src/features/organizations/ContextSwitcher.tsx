"use client";

import { useActionState } from "react";

import type { MembershipSummary } from "../../types/authorization";
import { setActiveOrganizationAction, type SetActiveOrganizationActionState } from "./actions";
import styles from "../dashboard/Dashboard.module.css";

type ContextSwitcherProps = {
  memberships: MembershipSummary[];
  activeOrganization: MembershipSummary | null;
};

const initialState: SetActiveOrganizationActionState = { status: "idle" };

export default function ContextSwitcher({ memberships, activeOrganization }: ContextSwitcherProps) {
  const [state, formAction, pending] = useActionState(setActiveOrganizationAction, initialState);
  const availableOrganizations = memberships.filter(
    (membership) => membership.status === "active" && membership.organizationStatus === "active"
  );

  if (availableOrganizations.length === 0) {
    return (
      <div className={styles.contextSwitcherEmpty} aria-label="Contesto organizzativo">
        <span className={styles.contextSwitcherLabel}>Contesto attivo</span>
        <strong>Nessuna organizzazione attiva</strong>
      </div>
    );
  }

  if (availableOrganizations.length === 1) {
    const organization = availableOrganizations[0];
    return (
      <div className={styles.contextSwitcherSingle} aria-label="Organizzazione attiva">
        <span className={styles.contextSwitcherLabel}>Organizzazione attiva</span>
        <strong>{organization.organizationDisplayName ?? "Organizzazione senza nome"}</strong>
        {organization.organizationTypeDisplayName ? <small>{organization.organizationTypeDisplayName}</small> : null}
      </div>
    );
  }

  return (
    <form className={styles.contextSwitcher} action={formAction}>
      <label className={styles.contextSwitcherLabel} htmlFor="active-organization">Organizzazione attiva</label>
      <div className={styles.contextSwitcherControls}>
        <select
          id="active-organization"
          name="organizationId"
          defaultValue={activeOrganization?.organizationId ?? availableOrganizations[0]?.organizationId}
          disabled={pending}
        >
          {availableOrganizations.map((organization) => (
            <option value={organization.organizationId} key={organization.organizationId}>
              {organization.organizationDisplayName ?? "Organizzazione senza nome"}
              {organization.organizationTypeDisplayName ? ` · ${organization.organizationTypeDisplayName}` : ""}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending}>
          {pending ? "Cambio…" : "Applica"}
        </button>
      </div>
      {state.status === "error" ? <p className={styles.contextSwitcherError} role="alert">{state.message}</p> : null}
    </form>
  );
}
