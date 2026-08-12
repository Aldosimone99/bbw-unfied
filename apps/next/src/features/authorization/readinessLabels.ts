export const personalProfileFieldLabels: Record<string, string> = {
  first_name: 'Nome',
  last_name: 'Cognome',
  birth_date: 'Data di nascita',
  tax_code: 'Codice fiscale',
  address: 'Indirizzo',
};

export const organizationProfileFieldLabels: Record<string, string> = {
  legal_name: 'Ragione sociale',
  display_name: 'Nome visualizzato',
  organization_type: 'Tipo di organizzazione',
  tax_identifier: 'Identificativo fiscale',
  email: 'Email',
  phone: 'Telefono',
  address: 'Indirizzo',
  owner: 'Referente autorizzato',
};

export const professionalBlockerLabels: Record<string, string> = {
  professional_profile_missing: 'Crea un profilo professionale',
  professional_verification_required: 'Invia la richiesta di verifica professionale',
  professional_verification_pending: 'La verifica professionale è in attesa',
  professional_verification_rejected: 'La verifica professionale è stata respinta',
  professional_verification_suspended: 'La verifica professionale è sospesa',
};

export function getReadinessLabel(value: string, labels: Record<string, string>): string {
  return labels[value] ?? value;
}
