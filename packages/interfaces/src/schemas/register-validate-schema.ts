import { z } from 'zod';
import { APP_ROLES } from '../enums/user-role';

const appRoleSchema = z.enum(APP_ROLES);

export const validatePersonalSchema = z.object({
  tipo_utente: appRoleSchema,
  nome: z.string().min(1).max(255),
  cognome: z.string().min(1).max(255),
  email: z.string().email().max(255),
  codice_fiscale: z.string().min(1).max(16),
  data_nascita: z.string().min(1),
  sesso: z.enum(['M', 'F']),
  telefono: z.string().min(1).max(50),
  codice_riferimento: z.string().max(50).optional(),
});

export const validateAddressSchema = z.object({
  via: z.string().min(1).max(255),
  citta: z.string().min(1).max(255),
  provincia: z.string().min(1).max(10),
  cap: z.string().min(1).max(10),
  nazione: z.string().min(1).max(100),
});

export const validateProfessionalSchema = z.object({
  titolo: z.string().min(1).max(255),
  numero_albo: z.string().min(1).max(100),
  numero_autorizzazione_asl: z.string().min(1).max(100),
  studio_via: z.string().max(255).optional(),
  studio_citta: z.string().max(255).optional(),
  studio_provincia: z.string().max(10).optional(),
  studio_cap: z.string().max(10).optional(),
  iban: z.string().max(34).optional(),
});

export const validateBusinessSchema = z.object({
  ragione_sociale: z.string().min(1).max(255),
  partita_iva: z.string().min(1).max(20),
  pec: z.string().email().max(255),
  codice_sdi: z.string().min(1).max(10),
  iban: z.string().max(34).optional(),
});

export const validatePasswordSchema = z.object({
  password: z.string().min(1),
});
