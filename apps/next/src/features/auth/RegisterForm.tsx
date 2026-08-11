"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { registerAction, type RegisterActionState } from "./actions";
import { isPasswordRequirementMet, passwordRequirements } from "./password-policy";
import styles from "../../components/forms/AuthPage.module.css";

const initialState: RegisterActionState = { status: "idle" };

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [password, setPassword] = useState("");

  return (
    <form className={styles.panel} action={formAction}>
      <div className={styles.panelHead}>
        <h2>Crea account</h2>
        <p className={styles.formMessage} aria-live="polite">
          {state.message}
        </p>
      </div>

      <label className={styles.field}>
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "register-email-error" : undefined}
        />
        {state.fieldErrors?.email && (
          <span id="register-email-error" className={styles.fieldError}>
            {state.fieldErrors.email.join(" ")}
          </span>
        )}
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={
            state.fieldErrors?.password
              ? "register-password-requirements register-password-error"
              : "register-password-requirements"
          }
        />
        <ul id="register-password-requirements" className={styles.passwordRequirements} aria-label="Requisiti password">
          {passwordRequirements.map((requirement) => {
            const isMet = isPasswordRequirementMet(requirement, password);

            return (
              <li key={requirement.id} className={isMet ? styles.passwordRequirementMet : undefined}>
                <span aria-hidden="true">{isMet ? "✓" : "○"}</span>
                {requirement.label}
              </li>
            );
          })}
        </ul>
        {state.fieldErrors?.password && (
          <span id="register-password-error" className={styles.fieldError}>
            {state.fieldErrors.password.join(" ")}
          </span>
        )}
      </label>

      <label className={styles.field}>
        <span>Conferma password</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          aria-describedby={state.fieldErrors?.confirmPassword ? "register-confirm-password-error" : undefined}
        />
        {state.fieldErrors?.confirmPassword && (
          <span id="register-confirm-password-error" className={styles.fieldError}>
            {state.fieldErrors.confirmPassword.join(" ")}
          </span>
        )}
      </label>

      <label className={styles.check}>
        <input
          name="acceptTerms"
          type="checkbox"
          required
          aria-invalid={Boolean(state.fieldErrors?.acceptTerms)}
          aria-describedby={state.fieldErrors?.acceptTerms ? "register-terms-error" : undefined}
        />
        <span>Accetto i termini e condizioni.</span>
      </label>
      {state.fieldErrors?.acceptTerms && (
        <span id="register-terms-error" className={styles.fieldError}>
          {state.fieldErrors.acceptTerms.join(" ")}
        </span>
      )}

      <label className={styles.check}>
        <input
          name="acceptPrivacy"
          type="checkbox"
          required
          aria-invalid={Boolean(state.fieldErrors?.acceptPrivacy)}
          aria-describedby={state.fieldErrors?.acceptPrivacy ? "register-privacy-error" : undefined}
        />
        <span>Accetto l’informativa privacy.</span>
      </label>
      {state.fieldErrors?.acceptPrivacy && (
        <span id="register-privacy-error" className={styles.fieldError}>
          {state.fieldErrors.acceptPrivacy.join(" ")}
        </span>
      )}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Creazione in corso…" : "Crea il mio account"}
      </button>

      <p className={styles.switchText}>
        Hai già un account? <Link href="/accedi">Accedi</Link>
      </p>
    </form>
  );
}
