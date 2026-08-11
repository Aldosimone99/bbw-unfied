import type { AppRole } from '../enums/user-role';

export interface ValidatePersonalRequest {
  tipo_utente: AppRole;
  nome: string;
  cognome: string;
  email: string;
  codice_fiscale: string;
  data_nascita: string;
  sesso: 'M' | 'F';
  telefono: string;
  codice_riferimento?: string;
}

export interface ValidateAddressRequest {
  via: string;
  citta: string;
  provincia: string;
  cap: string;
  nazione: string;
}

export interface ValidateProfessionalRequest {
  titolo: string;
  numero_albo: string;
  numero_autorizzazione_asl: string;
  studio_via?: string;
  studio_citta?: string;
  studio_provincia?: string;
  studio_cap?: string;
  iban?: string;
}

export interface ValidateBusinessRequest {
  ragione_sociale: string;
  partita_iva: string;
  pec: string;
  codice_sdi: string;
  iban?: string;
}

export interface ValidatePasswordRequest {
  password: string;
}

export interface StepValidationError {
  errors: Record<string, string>;
}
