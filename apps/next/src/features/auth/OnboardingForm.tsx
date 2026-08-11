"use client";

import { useActionState, useState } from "react";

import { onboardingIntentOptions } from "../../config/onboarding";
import type { ProfileSummary } from "../../types/authorization";
import type { OrganizationTypeOption } from "../../server/services/auth-service";
import { onboardingAction, type OnboardingActionState } from "./actions";
import styles from "../../components/forms/AuthPage.module.css";

type OnboardingFormProps = {
  profile: ProfileSummary;
  organizationTypes: OrganizationTypeOption[];
};

export default function OnboardingForm({ profile, organizationTypes }: OnboardingFormProps) {
  const initialState: OnboardingActionState = {
    status: "idle",
    step: profile.onboardingStatus === "account_type_required" ? "account_type" : "profile"
  };
  const [state, formAction, pending] = useActionState(onboardingAction, initialState);
  const isProfileStep = state.step === "profile";
  const [selectedAccountType, setSelectedAccountType] = useState(profile.requestedAccountType ?? "");

  return (
    <form className={styles.panel} action={formAction} noValidate>
      <div className={styles.panelHead}>
        <h2>{isProfileStep ? "Completa il profilo" : "Scegli la tua esperienza"}</h2>
        <p className={styles.formMessage} aria-live="polite">
          {state.message ?? (isProfileStep ? "Bastano pochi dati per iniziare." : "Potrai aggiornare questa richiesta in seguito.")}
        </p>
      </div>

      <input name="step" type="hidden" value={state.step} readOnly />

      {isProfileStep ? (
        <>
          <label className={styles.field}>
            <span>Nome</span>
            <input name="firstName" type="text" autoComplete="given-name" defaultValue={profile.firstName ?? ""} required aria-invalid={Boolean(state.fieldErrors?.firstName)} />
            {state.fieldErrors?.firstName?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </label>

          <label className={styles.field}>
            <span>Cognome</span>
            <input name="lastName" type="text" autoComplete="family-name" defaultValue={profile.lastName ?? ""} required aria-invalid={Boolean(state.fieldErrors?.lastName)} />
            {state.fieldErrors?.lastName?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </label>

          <label className={styles.field}>
            <span>Telefono facoltativo</span>
            <input name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} aria-invalid={Boolean(state.fieldErrors?.phone)} />
            {state.fieldErrors?.phone?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </label>
        </>
      ) : (
        <>
          <p className={styles.formMessage}>Profilo: {[profile.firstName, profile.lastName].filter(Boolean).join(" ")}</p>
          <fieldset className={styles.intentFieldset}>
            <legend>Come vuoi utilizzare Beauty Broker World?</legend>
            <div className={styles.intentGrid}>
              {onboardingIntentOptions.map((option) => (
                <label className={styles.intentOption} key={option.code}>
                  <input
                    name="accountType"
                    type="radio"
                    value={option.code}
                    checked={selectedAccountType === option.code}
                    onChange={() => setSelectedAccountType(option.code)}
                    required
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
            {state.fieldErrors?.accountType?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
          </fieldset>

          {selectedAccountType === "organization" ? (
            <>
              <label className={styles.field}>
                <span>Nome organizzazione</span>
                <input name="organizationDisplayName" type="text" autoComplete="organization" aria-invalid={Boolean(state.fieldErrors?.organizationDisplayName)} />
                {state.fieldErrors?.organizationDisplayName?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
              </label>

              <label className={styles.field}>
                <span>Tipo organizzazione</span>
                <select name="organizationTypeCode" defaultValue="" aria-invalid={Boolean(state.fieldErrors?.organizationTypeCode)}>
                  <option value="">Seleziona il tipo</option>
                  {organizationTypes.map((type) => <option value={type.code} key={type.code}>{type.displayName}</option>)}
                </select>
                {state.fieldErrors?.organizationTypeCode?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>)}
              </label>
            </>
          ) : null}
        </>
      )}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Salvataggio in corso…" : isProfileStep ? "Continua" : "Completa onboarding"}
      </button>
    </form>
  );
}
