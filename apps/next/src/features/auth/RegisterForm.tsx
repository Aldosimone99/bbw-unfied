"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import styles from "../../components/forms/AuthPage.module.css";
import { registerAction, type RegisterActionState } from "./actions";
import { isPasswordRequirementMet, passwordRequirements } from "./password-policy";

const initialState: RegisterActionState = { status: "idle" };

type FormValues = {
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
};

const initialValues: FormValues = {
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
  acceptPrivacy: false
};

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [values, setValues] = useState<FormValues>(initialValues);
  const errorFor = (field: keyof FormValues) =>
    state.fieldErrors?.[field]?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>);
  const update = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <form className={styles.panel} action={formAction} noValidate>
      <div className={styles.panelHead}>
        <h2>Crea account</h2>
        <p className={styles.formMessage} aria-live="polite">{state.message}</p>
      </div>

      <label className={styles.field}>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} />
        {errorFor("email")}
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} value={values.password} onChange={(event) => update("password", event.target.value)} />
        <ul className={styles.passwordRequirements} aria-label="Requisiti password">
          {passwordRequirements.map((requirement) => {
            const isMet = isPasswordRequirementMet(requirement, values.password);
            return (
              <li key={requirement.id} className={isMet ? styles.passwordRequirementMet : undefined}>
                <span aria-hidden="true">{isMet ? "✓" : "○"}</span>
                {requirement.label}
              </li>
            );
          })}
        </ul>
        {errorFor("password")}
      </label>

      <label className={styles.field}>
        <span>Conferma password</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} value={values.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} />
        {errorFor("confirmPassword")}
      </label>

      <label className={styles.check}>
        <input name="acceptTerms" type="checkbox" checked={values.acceptTerms} onChange={(event) => update("acceptTerms", event.target.checked)} />
        <span>Accetto i termini e condizioni.</span>
      </label>
      {errorFor("acceptTerms")}

      <label className={styles.check}>
        <input name="acceptPrivacy" type="checkbox" checked={values.acceptPrivacy} onChange={(event) => update("acceptPrivacy", event.target.checked)} />
        <span>Accetto l’informativa privacy.</span>
      </label>
      {errorFor("acceptPrivacy")}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Creazione in corso…" : "Crea il mio account"}
      </button>

      <p className={styles.switchText}>Hai già un account? <Link href="/accedi">Accedi</Link></p>
    </form>
  );
}
