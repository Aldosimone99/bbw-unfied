import { describe, expect, it } from 'vitest';
import {
  companyInviteAcceptSchema,
  companyInviteListResponseSchema,
  companyInviteRowSchema,
  createCompanyInviteRequestSchema,
  createInviteRequestSchema,
  inviteListResponseSchema,
  inviteLookupResponseSchema,
  inviteRegistrationFieldsSchema,
  inviteRowSchema,
  referralContextQuerySchema,
  referralCodeSchema,
} from '../../schemas/invite-schema';

describe('invite and referral contracts', () => {
  it('accepts registration fields for invite and referral context', () => {
    const result = inviteRegistrationFieldsSchema.safeParse({
      invite_code: 'INV-ABC123',
      invite_token: 'token-123',
      company_invite_token: 'company-token-123',
      codice_riferimento: 'COMM-ABC123',
      clinic_code: 'CLI-123',
      professional_code: 'MED-ABC123',
    });
    expect(result.success).toBe(true);
  });

  it('normalizes referral codes to uppercase', () => {
    const result = referralCodeSchema.safeParse('comm-abc123');
    expect(result.success).toBe(true);
    expect(result.data).toBe('COMM-ABC123');
  });

  it('accepts invite lookup responses', () => {
    const result = inviteLookupResponseSchema.safeParse({
      valid: true,
      code: 'INV-ABC123',
      email: 'mario@example.com',
      nome: 'Mario',
      cognome: 'Rossi',
      role: 'cliente',
      expiresAt: '2026-06-30T00:00:00.000Z',
      companyId: null,
      companyName: null,
    });
    expect(result.success).toBe(true);
  });

  it('requires token for company invite acceptance', () => {
    expect(companyInviteAcceptSchema.safeParse({ token: '' }).success).toBe(false);
    expect(companyInviteAcceptSchema.safeParse({ token: 'company-token' }).success).toBe(true);
  });

  it('accepts referral context query params', () => {
    const result = referralContextQuerySchema.safeParse({
      ref: 'REF-123',
      medico: 'MED-ABC123',
      clinica: 'CLI-ABC123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a strict create invite request with optional force', () => {
    const parsed = createInviteRequestSchema.parse({
      email: 'mario.rossi@example.com',
      type: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      expires_in_days: 10,
      force: true,
    });

    expect(parsed).toMatchObject({
      email: 'mario.rossi@example.com',
      type: 'cliente',
      force: true,
    });
  });

  it('rejects create invite requests with unknown keys', () => {
    expect(() => createInviteRequestSchema.parse({
      email: 'mario.rossi@example.com',
      type: 'cliente',
      unexpected: true,
    })).toThrow();
  });

  it('parses strict company invite create requests', () => {
    const parsed = createCompanyInviteRequestSchema.parse({
      email: 'medico@example.com',
      role: 'medico',
      nome: 'Mario',
      cognome: 'Rossi',
      expiresInDays: 14,
    });

    expect(parsed.role).toBe('medico');
  });

  it('rejects unsupported company invite roles', () => {
    expect(() => createCompanyInviteRequestSchema.parse({
      email: 'owner@example.com',
      role: 'owner',
    })).toThrow();
  });

  it('parses paginated company invite rows', () => {
    const row = companyInviteRowSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      company_id: '11111111-1111-4111-8111-111111111111',
      email: 'cliente@example.com',
      role: 'cliente',
      status: 'pending',
      nome: null,
      cognome: null,
      created_at: '2026-06-25T10:00:00.000Z',
      expires_at: '2026-07-02T10:00:00.000Z',
      accepted_by: null,
      accept_token: 'token-1',
      acceptLink: 'http://localhost:3000/company/invite/accept/token-1',
    });

    const parsed = companyInviteListResponseSchema.parse({
      data: [row],
      total: 1,
      page: 1,
      limit: 20,
      pages: 1,
    });

    expect(parsed.data[0].email).toBe('cliente@example.com');
  });

  it('parses paginated invite rows', () => {
    const row = inviteRowSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      code: 'INV-ABC123',
      email: 'mario.rossi@example.com',
      type: 'cliente',
      status: 'pending',
      nome: 'Mario',
      cognome: 'Rossi',
      created_at: '2026-06-25T10:00:00.000Z',
      expires_at: '2026-07-02T10:00:00.000Z',
      used_at: null,
      accept_token: 'token-1',
      acceptLink: 'http://localhost:3000/invite/accept/token-1',
    });

    expect(inviteListResponseSchema.parse({
      data: [row],
      total: 1,
      page: 1,
      limit: 20,
      pages: 1,
    }).data[0].code).toBe('INV-ABC123');
  });
});
