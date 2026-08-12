'use client';

import { useActionState } from 'react';

import type { ProfileSummary } from '../../types/authorization';
import { initialState, updateProfileAction } from './actions';
import styles from './Profile.module.css';

type ProfileFormProps = {
  profile: ProfileSummary;
};

export default function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const address = profile.address;

  return (
    <form className={styles.form} action={formAction} noValidate id="profile-form">
      <div className={styles.formMessage} aria-live="polite" data-status={state.status}>
        {state.message ?? 'Aggiorna i dati essenziali del tuo profilo.'}
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>Nome</span>
          <input name="first_name" type="text" autoComplete="given-name" defaultValue={profile.firstName ?? ''} aria-invalid={Boolean(state.fieldErrors?.first_name)} />
          {state.fieldErrors?.first_name?.map((error) => <small className={styles.fieldError} key={error}>{error}</small>)}
        </label>

        <label className={styles.field}>
          <span>Cognome</span>
          <input name="last_name" type="text" autoComplete="family-name" defaultValue={profile.lastName ?? ''} aria-invalid={Boolean(state.fieldErrors?.last_name)} />
          {state.fieldErrors?.last_name?.map((error) => <small className={styles.fieldError} key={error}>{error}</small>)}
        </label>
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>Data di nascita</span>
          <input name="birth_date" type="date" autoComplete="bday" defaultValue={profile.birthDate ?? ''} aria-invalid={Boolean(state.fieldErrors?.birth_date)} />
          {state.fieldErrors?.birth_date?.map((error) => <small className={styles.fieldError} key={error}>{error}</small>)}
        </label>

        <label className={styles.field}>
          <span>Codice fiscale</span>
          <input name="tax_code" type="text" autoComplete="off" defaultValue={profile.taxCode ?? ''} aria-invalid={Boolean(state.fieldErrors?.tax_code)} />
          {state.fieldErrors?.tax_code?.map((error) => <small className={styles.fieldError} key={error}>{error}</small>)}
        </label>
      </div>

      <label className={styles.field}>
        <span>Telefono <em>Opzionale</em></span>
        <input name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ''} aria-invalid={Boolean(state.fieldErrors?.phone)} />
        {state.fieldErrors?.phone?.map((error) => <small className={styles.fieldError} key={error}>{error}</small>)}
      </label>

      <fieldset className={styles.addressFieldset}>
        <legend>Indirizzo di residenza</legend>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Indirizzo</span>
            <input name="address_street" type="text" autoComplete="street-address" defaultValue={address?.street ?? ''} />
          </label>
          <label className={styles.field}>
            <span>Città</span>
            <input name="address_city" type="text" autoComplete="address-level2" defaultValue={address?.city ?? ''} />
          </label>
        </div>
        <div className={styles.fieldGridThree}>
          <label className={styles.field}>
            <span>CAP</span>
            <input name="address_postal_code" type="text" autoComplete="postal-code" defaultValue={address?.postal_code ?? ''} />
          </label>
          <label className={styles.field}>
            <span>Provincia</span>
            <input name="address_province" type="text" autoComplete="address-level1" defaultValue={address?.province ?? ''} />
          </label>
          <label className={styles.field}>
            <span>Paese</span>
            <input name="address_country_code" type="text" autoComplete="country" defaultValue={address?.country_code ?? 'IT'} />
          </label>
        </div>
      </fieldset>

      <button className={styles.saveButton} type="submit" disabled={pending}>
        {pending ? 'Salvataggio in corso…' : 'Salva modifiche'}
      </button>
    </form>
  );
}
