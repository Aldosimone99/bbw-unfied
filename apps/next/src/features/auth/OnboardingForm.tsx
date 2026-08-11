"use client";

import { useActionState, useState } from "react";

import { onboardingIntentOptions } from "../../config/onboarding";
import type { ProfileSummary } from "../../types/authorization";
import { onboardingAction, type OnboardingActionState } from "./actions";
import styles from "../../components/forms/AuthPage.module.css";

type OnboardingFormProps = { profile: ProfileSummary };

export default function OnboardingForm({ profile }: OnboardingFormProps) {
  const initialState: OnboardingActionState = {
    status: "idle",
    step: profile.onboardingStatus === "account_type_required" ? "account_type" : "profile"
  };
  const [state, formAction, pending] = useActionState(onboardingAction, initialState);
  const [profileValues, setProfileValues] = useState({
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    phone: profile.phone ?? ""
  });
  const [accountType, setAccountType] = useState(profile.requestedAccountType ?? "");
  const [organizationDisplayName, setOrganizationDisplayName] = useState("");
  const isProfileStep = state.step === "profile";
  const errorFor = (field: string) => state.fieldErrors?.[field]?.map((error) => <span className={styles.fieldError} key={error}>{error}</span>);

  return (
    <form className={styles.panel} action={formAction} noValidate>
      <div className={styles.panelHead}>
        <h2>{isProfileStep ? "Completa il profilo" : "Scegli la tua esperienza"}</h2>
        <p className={styles.formMessage} aria-live="polite">
          {state.message ?? (isProfileStep ? "Bastano pochi dati per iniziare." : "Potrai completare i dettagli operativi in seguito.")}
        </p>
      </div>

      <input name="step" type="hidden" value={state.step} readOnly />

      {isProfileStep ? (
        <>
          <label className={styles.field}>
            <span>Nome</span>
            <input name="firstName" type="text" autoComplete="given-name" value={profileValues.firstName} onChange={(event) => setProfileValues((current) => ({ ...current, firstName: event.target.value }))} />
            {errorFor("firstName")}
          </label>
          <label className={styles.field}>
            <span>Cognome</span>
            <input name="lastName" type="text" autoComplete="family-name" value={profileValues.lastName} onChange={(event) => setProfileValues((current) => ({ ...current, lastName: event.target.value }))} />
            {errorFor("lastName")}
          </label>
          <label className={styles.field}>
            <span>Telefono facoltativo</span>
            <input name="phone" type="tel" autoComplete="tel" value={profileValues.phone} onChange={(event) => setProfileValues((current) => ({ ...current, phone: event.target.value }))} />
            {errorFor("phone")}
          </label>
        </>
      ) : (
        <>
          <p className={styles.formMessage}>Profilo: {[profileValues.firstName, profileValues.lastName].filter(Boolean).join(" ")}</p>
          <fieldset className={styles.intentFieldset}>
            <legend>Come vuoi utilizzare Beauty Broker World?</legend>
            <div className={styles.intentGrid}>
              {onboardingIntentOptions.map((option) => (
                <label className={styles.intentOption} key={option.code}>
                  <input name="accountType" type="radio" value={option.code} checked={accountType === option.code} onChange={() => setAccountType(option.code)} />
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                </label>
              ))}
            </div>
            {errorFor("accountType")}
          </fieldset>

          {accountType === "organization" && (
            <label className={styles.field}>
              <span>Nome della clinica o organizzazione</span>
              <input name="organizationDisplayName" type="text" autoComplete="organization" value={organizationDisplayName} onChange={(event) => setOrganizationDisplayName(event.target.value)} />
              {errorFor("organizationDisplayName")}
            </label>
          )}
        </>
      )}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? "Salvataggio in corso…" : isProfileStep ? "Continua" : "Completa onboarding"}
      </button>
    </form>
  );
}
