'use client';

import { useActionState } from 'react';

import type { OrganizationProfile } from '../../server/services/organization-profile-service';
import {
  initialOrganizationProfileActionState,
  updateOrganizationProfileAction,
} from './profile-actions';
import styles from './OrganizationProfile.module.css';

type OrganizationProfileFormProps = {
  organization: OrganizationProfile;
};

export default function OrganizationProfileForm({ organization }: OrganizationProfileFormProps) {
  const action = updateOrganizationProfileAction.bind(null, organization.id);
  const [state, formAction, pending] = useActionState(action, initialOrganizationProfileActionState);
  const address = organization.address;

  return (
    <form className={styles.form} action={formAction} noValidate>
      <div className={styles.message} aria-live="polite" data-status={state.status}>
        {state.message ?? 'Inserisci i dati legali e di contatto dell’organizzazione.'}
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Ragione sociale</span>
          <input name="legal_name" type="text" autoComplete="organization" defaultValue={organization.legal_name ?? ''} />
        </label>
        <label className={styles.field}>
          <span>Nome visualizzato</span>
          <input name="display_name" type="text" defaultValue={organization.display_name ?? ''} />
        </label>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Identificativo fiscale</span>
          <input name="tax_identifier" type="text" defaultValue={organization.tax_identifier ?? ''} />
        </label>
        <label className={styles.field}>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" defaultValue={organization.email ?? ''} />
        </label>
      </div>

      <label className={styles.field}>
        <span>Telefono</span>
        <input name="phone" type="tel" autoComplete="tel" defaultValue={organization.phone ?? ''} />
      </label>

      <fieldset className={styles.address}>
        <legend>Indirizzo organizzazione</legend>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Indirizzo</span>
            <input name="address_street" type="text" autoComplete="street-address" defaultValue={address?.street ?? ''} />
          </label>
          <label className={styles.field}>
            <span>Città</span>
            <input name="address_city" type="text" autoComplete="address-level2" defaultValue={address?.city ?? ''} />
          </label>
        </div>
        <div className={styles.gridThree}>
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
        {pending ? 'Salvataggio in corso…' : 'Salva organizzazione'}
      </button>
    </form>
  );
}
