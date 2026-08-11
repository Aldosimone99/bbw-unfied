import type { SupabaseLike } from '../db/supabase';

export type ReferralKind =
  | 'commerciale'
  | 'invite'
  | 'medico'
  | 'estetista'
  | 'client_referral'
  | 'clinica';

export class ReferralCodeError extends Error {
  code = 'INVALID_REFERRAL_CODE';
  status = 422;
}

export function normalizeReferralCode(code: string): string {
  return String(code || '').trim().toUpperCase();
}

export function parseReferralCode(code: string): ReferralKind {
  const normalized = normalizeReferralCode(code);
  if (normalized.startsWith('COMM-')) return 'commerciale';
  if (normalized.startsWith('INV-')) return 'invite';
  if (normalized.startsWith('MED-')) return 'medico';
  if (normalized.startsWith('EST-')) return 'estetista';
  if (normalized.startsWith('REF-')) return 'client_referral';
  if (normalized.startsWith('CLI-')) return 'clinica';
  throw new ReferralCodeError('INVALID_REFERRAL_CODE');
}

export function generateProfessionalCode(prefix: 'MED' | 'COMM' | 'EST' | 'CLI' | 'REF' | 'INV'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function resolveReferralCode(db: SupabaseLike, code: string) {
  const normalized = normalizeReferralCode(code);
  const { data } = await db.from('referral_codes').select('*').eq('code', normalized).eq('is_active', true).maybeSingle();
  if (!data) throw new ReferralCodeError('REFERRAL_CODE_NOT_FOUND');
  return { code: normalized, referrerId: String((data as { user_id: string }).user_id), kind: parseReferralCode(normalized) };
}

export async function redeemReferralCode(
  db: SupabaseLike,
  code: string,
  referredUserId: string,
  context: { companyId?: string; professionalId?: string } = {},
): Promise<void> {
  const resolved = await resolveReferralCode(db, code);
  const { data: existing } = await db.from('referrals').select('id').eq('referred_id', referredUserId).eq('code_used', resolved.code).maybeSingle();
  if (existing) return;
  const { error } = await db.from('referrals').insert({
    referrer_id: resolved.referrerId,
    referred_id: referredUserId,
    code_used: resolved.code,
    company_id: context.companyId,
    professional_id: context.professionalId,
  });
  if (error) throw new ReferralCodeError('REFERRAL_REDEEM_FAILED');
}
