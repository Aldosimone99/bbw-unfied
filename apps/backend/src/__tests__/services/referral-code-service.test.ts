import { describe, expect, it, vi } from 'vitest';
import {
  normalizeReferralCode,
  parseReferralCode,
  redeemReferralCode,
  ReferralCodeError,
  resolveReferralCode,
} from '../../services/referral-code-service';

describe('referral-code-service', () => {
  it('normalizes codes to uppercase without spaces', () => {
    expect(normalizeReferralCode(' comm-abc123 ')).toBe('COMM-ABC123');
  });

  it.each([
    ['COMM-ABC123', 'commerciale'],
    ['INV-ABC123', 'invite'],
    ['MED-ABC123', 'medico'],
    ['EST-ABC123', 'estetista'],
    ['REF-ABC123', 'client_referral'],
    ['CLI-ABC123', 'clinica'],
  ] as const)('parses %s as %s', (code, kind) => {
    expect(parseReferralCode(code)).toBe(kind);
  });

  it('throws typed error for invalid codes', () => {
    expect(() => parseReferralCode('BAD-123')).toThrow(ReferralCodeError);
  });

  it('resolves active referral code to owner user', async () => {
    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'referrer-1', code: 'REF-ABC123', is_active: true } }),
      })),
    };
    await expect(resolveReferralCode(db, 'REF-ABC123')).resolves.toMatchObject({ referrerId: 'referrer-1' });
  });

  it('redeems referral code idempotently for a referred user', async () => {
    const inserts: unknown[] = [];
    const db = {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(table === 'referral_codes' ? { data: { user_id: 'referrer-1', code: 'REF-ABC123', is_active: true } } : { data: null }),
        insert: vi.fn((payload: unknown) => {
          inserts.push({ table, payload });
          return { error: null };
        }),
      })),
    };
    await redeemReferralCode(db, 'REF-ABC123', 'user-2');
    expect(inserts).toContainEqual(expect.objectContaining({
      table: 'referrals',
      payload: expect.objectContaining({ referrer_id: 'referrer-1', referred_id: 'user-2', code_used: 'REF-ABC123' }),
    }));
  });
});
