"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { registerAction, type RegisterActionState } from "./actions";
import { isPasswordRequirementMet, passwordRequirements } from "./password-policy";
import styles from "../../components/forms/AuthPage.module.css";

const initialState: RegisterActionState = { status: "idle" };

const roleOptions = [
  { value: "cliente", label: "Cliente" },
  { value: "medico", label: "Medico" },
  { value: "estetista", label: "Estetista" },
  { value: "clinica", label: "Clinica" },
  { value: "commerciale", label: "Commerciale" }
] as const;

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cliente");
  const requiresBusiness = role === "clinica" || role === "commerciale";
  const requiresProfessional = role === "medico" || role === "estetista";

  return (
    <form className={styles.panel} action={formAction} noValidate>
      <div className={styles.panelHead}>
        <h2>Crea account</h2>
        <p className={styles.formMessage} aria-live="polite">{state.message}</p>
      </div>

      <label className={styles.field}>
        <span>Tipo di account</span>
        <select name="tipoUtente" value={role} onChange={(event) => setRole(event.target.value)}>
          {roleOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        {state.fieldErrors?.tipoUtente?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
      </label>

      {role !== "clinica" && (
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span>Nome</span>
            <input name="nome" autoComplete="given-name" required />
            {state.fieldErrors?.nome?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </label>
          <label className={styles.field}>
            <span>Cognome</span>
            <input name="cognome" autoComplete="family-name" required />
            {state.fieldErrors?.cognome?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </label>
        </div>
      )}

      {role !== "clinica" && (
        <label className={styles.field}>
          <span>Codice fiscale</span>
          <input name="codiceFiscale" maxLength={16} autoComplete="off" required />
          {state.fieldErrors?.codiceFiscale?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
        </label>
      )}

      {requiresBusiness && (
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span>Ragione sociale</span>
            <input name="ragioneSociale" autoComplete="organization" required />
            {state.fieldErrors?.ragioneSociale?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </label>
          <label className={styles.field}>
            <span>Partita IVA</span>
            <input name="partitaIva" autoComplete="off" required />
            {state.fieldErrors?.partitaIva?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </label>
        </div>
      )}

      {requiresProfessional && (
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span>Città dello studio</span>
            <input name="studioCitta" autoComplete="address-level2" required />
            {state.fieldErrors?.studioCitta?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </label>
          {role === "medico" && (
            <label className={styles.field}>
              <span>Numero albo</span>
              <input name="numeroAlbo" autoComplete="off" required />
              {state.fieldErrors?.numeroAlbo?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
            </label>
          )}
        </div>
      )}

      <label className={styles.field}>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
        {state.fieldErrors?.email?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
        <ul className={styles.passwordRequirements} aria-label="Requisiti password">
          {passwordRequirements.map((requirement) => <li key={requirement.id} className={isPasswordRequirementMet(requirement, password) ? styles.passwordRequirementMet : undefined}>{isPasswordRequirementMet(requirement, password) ? "✓" : "○"} {requirement.label}</li>)}
        </ul>
        {state.fieldErrors?.password?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
      </label>

      <label className={styles.field}>
        <span>Conferma password</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required />
        {state.fieldErrors?.confirmPassword?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
      </label>

      <div className={styles.formRow}>
        <button className={styles.secondaryButton} type="submit" name="_action" value="send_otp" disabled={pending}>Invia codice email</button>
        {state.otpReference && <span className={styles.formMessage}>Codice valido per 10 minuti.</span>}
      </div>
      {state.devOtpCode && <p className={styles.formMessage}>Codice locale: <strong>{state.devOtpCode}</strong></p>}

      <input type="hidden" name="otpReference" value={state.otpReference ?? ""} readOnly />
      {state.otpReference && (
        <label className={styles.field}>
          <span>Codice ricevuto via email</span>
          <input name="otpCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
          {state.fieldErrors?.otpCode?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
        </label>
      )}

      <label className={styles.check}><input name="acceptTerms" type="checkbox" required /><span>Accetto i termini e condizioni.</span></label>
      <label className={styles.check}><input name="acceptPrivacy" type="checkbox" required /><span>Accetto l’informativa privacy.</span></label>

      <button className={styles.primaryButton} type="submit" name="_action" value="register" disabled={pending}>
        {pending ? "Creazione in corso…" : "Crea il mio account"}
      </button>

      <p className={styles.switchText}>Hai già un account? <Link href="/accedi">Accedi</Link></p>
    </form>
  );
}
