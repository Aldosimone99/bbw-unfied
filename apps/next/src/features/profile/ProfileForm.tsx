"use client";

import { useActionState } from "react";

import type { ProfileSummary } from "../../types/authorization";
import { updateProfileAction, type ProfileActionState } from "./actions";
import styles from "./Profile.module.css";

type ProfileFormProps = {
  profile: ProfileSummary;
};

const initialState: ProfileActionState = { status: "idle" };

export default function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form className={styles.form} action={formAction} noValidate>
      <div className={styles.formMessage} aria-live="polite" data-status={state.status}>
        {state.message ?? "Aggiorna i dati essenziali del tuo profilo."}
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>Nome</span>
          <input
            name="firstName"
            type="text"
            autoComplete="given-name"
            defaultValue={profile.firstName ?? ""}
            required
            aria-invalid={Boolean(state.fieldErrors?.firstName)}
          />
          {state.fieldErrors?.firstName?.map((error) => <small className={styles.fieldError} key={error}>{error}</small>)}
        </label>

        <label className={styles.field}>
          <span>Cognome</span>
          <input
            name="lastName"
            type="text"
            autoComplete="family-name"
            defaultValue={profile.lastName ?? ""}
            required
            aria-invalid={Boolean(state.fieldErrors?.lastName)}
          />
          {state.fieldErrors?.lastName?.map((error) => <small className={styles.fieldError} key={error}>{error}</small>)}
        </label>
      </div>

      <label className={styles.field}>
        <span>Telefono</span>
        <input name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} aria-invalid={Boolean(state.fieldErrors?.phone)} />
        {state.fieldErrors?.phone?.map((error) => <small className={styles.fieldError} key={error}>{error}</small>)}
      </label>

      <button className={styles.saveButton} type="submit" disabled={pending}>
        {pending ? "Salvataggio in corso…" : "Salva modifiche"}
      </button>
    </form>
  );
}
