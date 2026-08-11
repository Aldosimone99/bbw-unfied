import type { RegisterRequest } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { devStore } from './otp-service';
import { acceptCompanyInvite, lookupCompanyInvite } from './company-invite-service';
import { lookupInviteByToken, redeemInviteCode, validateInviteCode } from './invite-service';
import { generateProfessionalCode, redeemReferralCode, resolveReferralCode } from './referral-code-service';

interface RegistrationErrorShape {
  code: string;
  status: number;
  message?: string;
}

export class RegistrationError extends Error {
  constructor(public readonly details: RegistrationErrorShape) {
    super(details.message ?? details.code);
  }
}

function hasAny(payload: RegisterRequest, keys: Array<keyof RegisterRequest>): boolean {
  return keys.some((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '');
}

async function assertEmailAvailable(db: SupabaseLike, email: string): Promise<void> {
  const { data } = await db.from('users').select('id').eq('email', email).maybeSingle();
  if (data) throw new RegistrationError({ code: 'EMAIL_ALREADY_EXISTS', status: 409 });
}

async function assertCodiceFiscaleAvailable(db: SupabaseLike, codiceFiscale?: string): Promise<void> {
  if (!codiceFiscale) return;
  const normalized = codiceFiscale.trim().toUpperCase();
  const { data } = await db.from('users').select('id').eq('codice_fiscale', normalized).maybeSingle();
  if (data) throw new RegistrationError({ code: 'CODICE_FISCALE_ALREADY_EXISTS', status: 409 });
}

async function assertRegistrationOtpVerified(db: SupabaseLike, email: string, reference: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const record = devStore.get(reference) as { email: string; verifiedAt: number | null; expiresAt: number } | undefined;
    if (!record || record.email !== email || !record.verifiedAt || Date.now() > record.expiresAt) {
      throw new RegistrationError({ code: 'REGISTRATION_OTP_REQUIRED', status: 422 });
    }
    return;
  }

  const { data } = await db
    .from('otps')
    .select('reference,email,purpose,verified_at,expires_at')
    .eq('reference', reference)
    .eq('email', email)
    .eq('purpose', 'registration')
    .maybeSingle();

  const otpData = data as { verified_at?: string | null; expires_at?: string | null } | null;
  const verifiedAt = otpData?.verified_at;
  const expiresAt = otpData?.expires_at;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : true;

  if (!data || !verifiedAt || isExpired) {
    throw new RegistrationError({ code: 'REGISTRATION_OTP_REQUIRED', status: 422 });
  }
}

async function assertUniqueField(
  db: SupabaseLike,
  table: string,
  column: string,
  value: string | undefined,
  errorCode: string,
): Promise<void> {
  if (!value) return;
  const { data } = await db.from(table).select('user_id,id').eq(column, value).maybeSingle();
  if (data) throw new RegistrationError({ code: errorCode, status: 409 });
}

async function insertOrThrow(query: PromiseLike<{ error?: unknown }>): Promise<void> {
  const { error } = await query;
  if (error) throw error;
}

export async function registerUser(
  db: SupabaseLike,
  payload: RegisterRequest,
  metadata: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ userId: string }> {
  await assertEmailAvailable(db, payload.email);
  await assertCodiceFiscaleAvailable(db, payload.codice_fiscale);
  await assertRegistrationOtpVerified(db, payload.email, payload.otp_reference);
  await assertUniqueField(db, 'user_business_profiles', 'partita_iva', payload.partita_iva, 'PARTITA_IVA_ALREADY_EXISTS');
  await assertUniqueField(db, 'user_business_profiles', 'iban', payload.iban, 'IBAN_ALREADY_EXISTS');
  await assertUniqueField(db, 'professional_credentials', 'numero_albo', payload.numero_albo, 'NUMERO_ALBO_ALREADY_EXISTS');
  try {
    if (payload.invite_code) await validateInviteCode(db, payload.invite_code);
    if (payload.invite_token) {
      const invite = await lookupInviteByToken(db, payload.invite_token);
      if (invite.code) await validateInviteCode(db, invite.code);
    }
    if (payload.company_invite_token) await lookupCompanyInvite(db, payload.company_invite_token);
    if (payload.codice_riferimento) await resolveReferralCode(db, payload.codice_riferimento);
    if (payload.professional_code) await resolveReferralCode(db, payload.professional_code);
    if (payload.clinic_code) await resolveReferralCode(db, payload.clinic_code);
  } catch (error) {
    const err = error as { code?: string; status?: number };
    throw new RegistrationError({ code: err.code ?? 'INVITE_VALIDATION_FAILED', status: err.status ?? 422 });
  }

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
  });

  const userId = authData?.user?.id;
  if (authError || !userId) {
    throw new RegistrationError({ code: 'AUTH_USER_CREATE_FAILED', status: 502, message: authError?.message });
  }

  try {
    await insertOrThrow(db.from('users').insert({
      id: userId,
      email: payload.email,
      tipo_utente: payload.tipo_utente,
      nome: payload.nome,
      cognome: payload.cognome,
      titolo: payload.titolo,
      telefono: payload.telefono,
      data_nascita: payload.data_nascita,
      sesso: payload.sesso,
      codice_fiscale: payload.codice_fiscale,
      tipo_soggetto: payload.tipo_soggetto,
      consenso_marketing: payload.consenso_marketing,
      consenso_profilazione: payload.consenso_profilazione,
    }));

    await insertOrThrow(db.from('user_consents').insert({
      user_id: userId,
      accepted_at: new Date().toISOString(),
      ip_address: metadata.ipAddress,
      user_agent: metadata.userAgent,
      version: '1.0',
    }));

    if (hasAny(payload, ['via', 'citta', 'provincia', 'cap'])) {
      await insertOrThrow(db.from('user_addresses').insert({
        user_id: userId,
        via: payload.via,
        citta: payload.citta,
        provincia: payload.provincia,
        cap: payload.cap,
        nazione: payload.nazione ?? 'IT',
      }));
    }

    if (['medico', 'estetista', 'commerciale', 'clinica'].includes(payload.tipo_utente)) {
      await insertOrThrow(db.from('user_business_profiles').insert({
        user_id: userId,
        ragione_sociale: payload.ragione_sociale,
        partita_iva: payload.partita_iva,
        pec: payload.pec,
        codice_sdi: payload.codice_sdi ?? '0000000',
        iban: payload.iban,
        azienda_via: payload.azienda_via,
        azienda_citta: payload.azienda_citta,
        azienda_provincia: payload.azienda_provincia,
        azienda_cap: payload.azienda_cap,
        azienda_nazione: payload.azienda_nazione ?? 'IT',
      }));
    }

    if (['medico', 'estetista', 'commerciale'].includes(payload.tipo_utente)) {
      await insertOrThrow(db.from('professional_credentials').insert({
        user_id: userId,
        numero_albo: payload.numero_albo,
        numero_autorizzazione_asl: payload.numero_autorizzazione_asl,
        specializzazioni: payload.specializzazioni,
        documento_tipo: payload.documento_tipo,
        documento_numero: payload.documento_numero,
        documento_comune_rilascio: payload.documento_comune_rilascio,
        codice_medico: payload.tipo_utente === 'medico' ? generateProfessionalCode('MED') : null,
        codice_commerciale: payload.tipo_utente === 'commerciale' ? generateProfessionalCode('COMM') : null,
        codice_riferimento: payload.codice_riferimento,
        dichiarazione_assenza_carichi_giudiziari: payload.dichiarazione_assenza_carichi_giudiziari ?? false,
      }));
    }

    if (['medico', 'estetista'].includes(payload.tipo_utente)) {
      await insertOrThrow(db.from('professional_studios').insert({
        user_id: userId,
        via: payload.studio_via,
        citta: payload.studio_citta,
        provincia: payload.studio_provincia,
        cap: payload.studio_cap,
      }));
    }

    if (payload.invite_code) await redeemInviteCode(db, payload.invite_code, userId);
    if (payload.invite_token) {
      const invite = await lookupInviteByToken(db, payload.invite_token);
      if (invite.code) await redeemInviteCode(db, invite.code, userId);
    }
    if (payload.company_invite_token) await acceptCompanyInvite(db, payload.company_invite_token, userId);
    if (payload.codice_riferimento) await redeemReferralCode(db, payload.codice_riferimento, userId);
    if (payload.professional_code) await redeemReferralCode(db, payload.professional_code, userId);
    if (payload.clinic_code) await redeemReferralCode(db, payload.clinic_code, userId);

    return { userId };
  } catch (error) {
    await db.auth.admin.deleteUser(userId);
    throw new RegistrationError({ code: 'REGISTRATION_FAILED', status: 500, message: error instanceof Error ? error.message : undefined });
  }
}
