import { z } from 'zod';
import { APP_ROLES, PERSISTED_USER_TYPES } from '../enums/user-role';

export const appRoleSchema = z.enum(APP_ROLES);
export const persistedUserTypeSchema = z.enum(PERSISTED_USER_TYPES);
export const registerableRoleSchema = appRoleSchema.exclude(['admin']);

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const strongPasswordSchema = z.string()
  .min(8)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a digit')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol');

export const profileUpdateSchema = z.object({
  nome: z.string().min(1).max(255).optional(),
  cognome: z.string().max(255).optional(),
  titolo: z.string().optional(),
  telefono: z.string().max(50).optional(),
  avatar: z.string().url().optional(),
  sesso: z.enum(['M', 'F']).optional(),
  via: z.string().max(255).optional(),
  citta: z.string().max(255).optional(),
  provincia: z.string().max(10).optional(),
  cap: z.string().max(10).optional(),
  localita: z.string().optional(),
  nazione: z.string().max(100).optional(),
  ragione_sociale: z.string().max(255).optional(),
  partita_iva: z.string().max(20).optional(),
  pec: z.string().email().max(255).optional(),
  codice_sdi: z.string().max(10).optional(),
  iban: z.string().max(34).optional(),
  azienda_via: z.string().max(255).optional(),
  azienda_citta: z.string().max(255).optional(),
  azienda_provincia: z.string().max(10).optional(),
  azienda_cap: z.string().max(10).optional(),
  azienda_nazione: z.string().max(100).optional(),
  numero_albo: z.string().max(100).optional(),
  numero_autorizzazione_asl: z.string().max(100).optional(),
  specializzazioni: z.array(z.string()).optional(),
  documento_tipo: z.string().optional(),
  documento_numero: z.string().optional(),
  documento_comune_rilascio: z.string().optional(),
  dichiarazione_assenza_carichi_giudiziari: z.boolean().optional(),
  studio_via: z.string().max(255).optional(),
  studio_citta: z.string().max(255).optional(),
  studio_provincia: z.string().max(10).optional(),
  studio_cap: z.string().max(10).optional(),
}).strict();

export const registerRequestSchema = z.object({
  tipo_utente: registerableRoleSchema.optional(),
  email: z.string().email().max(255),
  password: strongPasswordSchema,
  otp_reference: z.string().min(1).optional(),
  accept_terms: z.literal(true),
  accept_privacy: z.literal(true),
  nome: z.string().min(1).max(255).optional(),
  cognome: z.string().max(255).optional(),
  codice_fiscale: z.string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().length(16))
    .optional(),
  data_nascita: z.string().optional(),
  sesso: z.enum(['M', 'F']).optional(),
  telefono: z.string().max(50).optional(),
  consenso_marketing: z.boolean(),
  consenso_profilazione: z.boolean(),
  codice_riferimento: z.string().max(50).optional(),
  invite_code: z.string().trim().optional(),
  invite_token: z.string().trim().optional(),
  company_invite_token: z.string().trim().optional(),
  clinic_code: z.string().trim().optional(),
  professional_code: z.string().trim().optional(),
  tipo_soggetto: z.enum(['privato', 'azienda']).optional(),
  titolo: z.string().optional(),
  numero_albo: z.string().max(100).optional(),
  numero_autorizzazione_asl: z.string().max(100).optional(),
  specializzazioni: z.array(z.string()).optional(),
  documento_tipo: z.string().optional(),
  documento_numero: z.string().optional(),
  documento_comune_rilascio: z.string().optional(),
  dichiarazione_assenza_carichi_giudiziari: z.boolean().optional(),
  ragione_sociale: z.string().max(255).optional(),
  partita_iva: z.string().max(20).optional(),
  pec: z.string().email().max(255).optional(),
  codice_sdi: z.string().max(10).optional(),
  iban: z.string().max(34).optional(),
  via: z.string().max(255).optional(),
  citta: z.string().max(255).optional(),
  provincia: z.string().max(10).optional(),
  cap: z.string().max(10).optional(),
  localita: z.string().optional(),
  nazione: z.string().max(100).optional(),
  azienda_via: z.string().max(255).optional(),
  azienda_citta: z.string().max(255).optional(),
  azienda_provincia: z.string().max(10).optional(),
  azienda_cap: z.string().max(10).optional(),
  azienda_nazione: z.string().max(100).optional(),
  studio_via: z.string().max(255).optional(),
  studio_citta: z.string().max(255).optional(),
  studio_provincia: z.string().max(10).optional(),
  studio_cap: z.string().max(10).optional(),
}).superRefine((payload, ctx) => {
  if (!payload.tipo_utente) return;

  const needsPerson = payload.tipo_utente !== 'clinica';
  if (needsPerson && !payload.codice_fiscale) {
    ctx.addIssue({ code: 'custom', path: ['codice_fiscale'], message: 'codice_fiscale is required' });
  }
  if (needsPerson && !payload.nome) {
    ctx.addIssue({ code: 'custom', path: ['nome'], message: 'nome is required' });
  }
  if (needsPerson && !payload.cognome) {
    ctx.addIssue({ code: 'custom', path: ['cognome'], message: 'cognome is required' });
  }
  if ((payload.tipo_utente === 'medico' || payload.tipo_utente === 'estetista') && !payload.studio_citta) {
    ctx.addIssue({ code: 'custom', path: ['studio_citta'], message: 'studio_citta is required for professionals' });
  }
  if (payload.tipo_utente === 'medico' && !payload.numero_albo) {
    ctx.addIssue({ code: 'custom', path: ['numero_albo'], message: 'numero_albo is required for medico' });
  }
  if ((payload.tipo_utente === 'commerciale' || payload.tipo_utente === 'clinica') && !payload.ragione_sociale) {
    ctx.addIssue({ code: 'custom', path: ['ragione_sociale'], message: 'ragione_sociale is required' });
  }
  if ((payload.tipo_utente === 'commerciale' || payload.tipo_utente === 'clinica') && !payload.partita_iva) {
    ctx.addIssue({ code: 'custom', path: ['partita_iva'], message: 'partita_iva is required' });
  }
});

export const currentUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  tipo_utente: persistedUserTypeSchema,
  nome: z.string().nullable().optional(),
  cognome: z.string().nullable().optional(),
}).passthrough();

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
