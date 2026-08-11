import type { SupabaseLike } from '../db/supabase';

export class PublicProfileError extends Error {
  constructor(public code: string, public statusCode: number, message = code) {
    super(message);
  }
}

export async function getPublicProfessionalProfile(db: SupabaseLike, slug: string) {
  const { data, error } = await db
    .from('users')
    .select('id, nome, cognome, profile_slug, tipo_utente, specializzazioni, bio, photo_url')
    .eq('profile_slug', slug)
    .maybeSingle();
  if (error) throw new PublicProfileError('PUBLIC_PROFILE_READ_FAILED', 500);
  if (!data) throw new PublicProfileError('PUBLIC_PROFILE_NOT_FOUND', 404);

  const profile = data as any;
  const { data: settings } = await db
    .from('booking_settings')
    .select('online_booking_enabled')
    .eq('professional_id', profile.id)
    .maybeSingle();

  return {
    id: profile.id,
    nome: profile.nome ?? '',
    cognome: profile.cognome ?? '',
    profile_slug: profile.profile_slug,
    tipo_utente: profile.tipo_utente,
    specializzazioni: profile.specializzazioni ?? [],
    bio: profile.bio ?? null,
    photo_url: profile.photo_url ?? null,
    online_booking_enabled: Boolean((settings as { online_booking_enabled?: boolean } | null)?.online_booking_enabled),
  };
}
