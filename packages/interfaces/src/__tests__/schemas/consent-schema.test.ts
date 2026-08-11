import { describe, expect, it } from 'vitest';
import {
  addConsentVersionSchema,
  consentDocumentRowSchema,
  consentTemplateRowSchema,
  createConsentTemplateSchema,
  requestOTPSchema,
  revokeConsentSchema,
  signConsentSchema,
} from '../../schemas/consent-schema';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('consent schemas', () => {
  it('accepts editor and uploaded templates but rejects ai_generated', () => {
    expect(createConsentTemplateSchema.parse({
      name: 'Consenso filler',
      category: 'injectable',
      contentHtml: '<p>Testo</p>',
      source: 'editor',
      requiresClinicSignature: true,
      disclaimerAccepted: true,
    }).source).toBe('editor');

    expect(createConsentTemplateSchema.safeParse({
      name: 'AI',
      category: 'injectable',
      contentHtml: '<p>Testo</p>',
      source: 'ai_generated',
      disclaimerAccepted: true,
    }).success).toBe(false);
  });

  it('validates document editing, revoke, otp, and signature requests', () => {
    expect(addConsentVersionSchema.parse({ contentHtml: '<p>v2</p>', changesSummary: 'Fix' }).contentHtml).toBe('<p>v2</p>');
    expect(revokeConsentSchema.parse({ reason: 'Errore dati paziente' }).reason).toContain('Errore');
    expect(requestOTPSchema.parse({
      deviceFingerprint: {
        screenResolution: '1920x1080',
        timezone: 'Europe/Rome',
        canvasHash: 'abc',
        language: 'it-IT',
        platform: 'MacIntel',
      },
    }).deviceFingerprint.language).toBe('it-IT');

    expect(signConsentSchema.parse({
      method: 'OTP_EMAIL',
      otpReference: uuid,
      otpCode: '123456',
      signedAt: '2026-06-25T12:00:00.000Z',
      deviceFingerprint: {
        screenResolution: '1920x1080',
        timezone: 'Europe/Rome',
        canvasHash: 'abc',
        language: 'it-IT',
        platform: 'MacIntel',
      },
    }).method).toBe('OTP_EMAIL');
  });

  it('parses consent template and document rows', () => {
    expect(consentTemplateRowSchema.parse({
      id: uuid,
      owner_id: uuid,
      owner_type: 'medico',
      company_id: null,
      name: 'Consenso',
      description: null,
      category: 'laser',
      treatment_types: ['laser'],
      content_html: '<p>Testo</p>',
      source: 'uploaded',
      requires_clinic_signature: true,
      disclaimer_accepted: true,
      disclaimer_accepted_at: '2026-06-25T12:00:00.000Z',
      is_active: true,
      created_at: '2026-06-25T12:00:00.000Z',
      updated_at: '2026-06-25T12:00:00.000Z',
    }).source).toBe('uploaded');

    expect(consentDocumentRowSchema.parse({
      id: uuid,
      template_id: uuid,
      treatment_id: uuid,
      professional_id: uuid,
      client_id: uuid,
      company_id: null,
      professional_role: 'medico',
      status: 'awaiting_doctor_signature',
      current_version_id: null,
      content_hash: null,
      draft_created_at: '2026-06-25T12:00:00.000Z',
      reviewed_at: null,
      professional_signed_at: null,
      clinic_signed_at: null,
      client_signed_at: null,
      revoked_at: null,
      revoked_reason: null,
      created_at: '2026-06-25T12:00:00.000Z',
      updated_at: '2026-06-25T12:00:00.000Z',
    }).status).toBe('awaiting_doctor_signature');
  });
});
