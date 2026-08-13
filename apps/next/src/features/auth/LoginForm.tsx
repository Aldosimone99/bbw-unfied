"use client";

import Link from "next/link";
import { useActionState } from "react";

import styles from "../../components/forms/AuthPage.module.css";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = { status: "idle" };

export default function LoginForm({
  redirectTo,
  invitationToken,
}: Readonly<{ redirectTo?: string; invitationToken?: string }>) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form className={styles.panel} action={formAction} noValidate>
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      {invitationToken && <input type="hidden" name="invitationToken" value={invitationToken} />}
      <div className={styles.panelHead}>
        <h2>Login</h2>
        <p className={styles.formMessage} aria-live="polite">
          {state.message}
        </p>
      </div>

      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="nome@email.it"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {state.fieldErrors?.email?.map((error) => (
          <span className={styles.fieldError} key={error}>
            {error}
          </span>
        ))}
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="La tua password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        {state.fieldErrors?.password?.map((error) => (
          <span className={styles.fieldError} key={error}>
            {error}
          </span>
        ))}
      </label>

      <div className={styles.formRow}>
        <label className={styles.check}>
          <input type="checkbox" name="remember" />
          <span>Ricordami</span>
        </label>
        <a href="mailto:info@beautybrokerworld.it">Password dimenticata?</a>
      </div>

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Accesso in corso…" : "Accedi"}
      </button>

      <p className={styles.switchText}>
        Non hai un account? <Link href="/registrati">Registrati</Link>
      </p>
    </form>
  );
}
