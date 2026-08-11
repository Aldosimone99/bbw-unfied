import type { AppRole, ProfileUpdateRequest } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import type { ResolvedUser } from './types';

const profileSelect = `
  *,
  user_addresses(*),
  user_business_profiles(*),
  professional_credentials!professional_credentials_user_id_fkey(*),
  professional_studios(*),
  user_consents(accepted_at, version)
`;

const baseKeys = ['nome', 'cognome', 'titolo', 'telefono', 'avatar', 'sesso'] as const;
const addressKeys = ['via', 'citta', 'provincia', 'cap', 'localita', 'nazione'] as const;
const businessKeys = ['ragione_sociale', 'partita_iva', 'pec', 'codice_sdi', 'iban', 'azienda_via', 'azienda_citta', 'azienda_provincia', 'azienda_cap', 'azienda_nazione'] as const;
const credentialKeys = ['numero_albo', 'numero_autorizzazione_asl', 'specializzazioni', 'documento_tipo', 'documento_numero', 'documento_comune_rilascio', 'dichiarazione_assenza_carichi_giudiziari'] as const;
const studioKeys = ['studio_via', 'studio_citta', 'studio_provincia', 'studio_cap'] as const;

export class ProfileAccessError extends Error {
  status = 403;
  code = 'FORBIDDEN_PROFILE_FIELDS';
}

function pick<T extends Record<string, unknown>, K extends readonly string[]>(payload: T, keys: K): Record<K[number], unknown> {
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    if (payload[key] !== undefined) acc[key] = payload[key];
    return acc;
  }, {}) as Record<K[number], unknown>;
}

function hasFields(fields: Record<string, unknown>): boolean {
  return Object.keys(fields).length > 0;
}

function assertRole(actual: AppRole, allowed: AppRole[]): void {
  if (actual === 'admin') return;
  if (!allowed.includes(actual)) throw new ProfileAccessError('FORBIDDEN_PROFILE_FIELDS');
}

export async function getCurrentUserProfile(db: SupabaseLike, userId: string) {
  const { data, error } = await db.from('users').select(profileSelect).eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateCurrentUserProfile(db: SupabaseLike, user: ResolvedUser, payload: ProfileUpdateRequest) {
  if ('tipo_utente' in payload) throw new ProfileAccessError('ROLE_CHANGE_NOT_ALLOWED');

  const base = pick(payload, baseKeys);
  if (hasFields(base)) await db.from('users').update(base).eq('id', user.id);

  const address = pick(payload, addressKeys);
  if (hasFields(address)) await db.from('user_addresses').upsert({ user_id: user.id, ...address });

  const business = pick(payload, businessKeys);
  if (hasFields(business)) {
    assertRole(user.tipo_utente, ['medico', 'estetista', 'commerciale', 'clinica']);
    await db.from('user_business_profiles').upsert({ user_id: user.id, ...business });
  }

  const credentials = pick(payload, credentialKeys);
  if (hasFields(credentials)) {
    assertRole(user.tipo_utente, ['medico', 'estetista', 'commerciale']);
    await db.from('professional_credentials').upsert({ user_id: user.id, ...credentials });
  }

  const studio = pick(payload, studioKeys);
  if (hasFields(studio)) {
    assertRole(user.tipo_utente, ['medico', 'estetista']);
    await db.from('professional_studios').upsert({
      user_id: user.id,
      via: studio.studio_via,
      citta: studio.studio_citta,
      provincia: studio.studio_provincia,
      cap: studio.studio_cap,
    });
  }

  return getCurrentUserProfile(db, user.id);
}
