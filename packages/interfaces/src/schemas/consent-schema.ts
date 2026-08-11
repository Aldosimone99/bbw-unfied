import { z } from 'zod';

const uuid = z.string().uuid();

export const deviceFingerprintSchema = z.object({
  screenResolution: z.string(),
  timezone: z.string(),
  canvasHash: z.string(),
  language: z.string(),
  platform: z.string(),
});

export const createConsentTemplateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  category: z.string().trim().min(1),
  treatmentTypes: z.array(z.string()).optional(),
  contentHtml: z.string().min(1),
  source: z.enum(['editor', 'uploaded']),
  requiresClinicSignature: z.boolean().optional(),
  disclaimerAccepted: z.boolean(),
}).strict();

export const updateConsentTemplateSchema = createConsentTemplateSchema.partial().strict();

export const addConsentVersionSchema = z.object({
  contentHtml: z.string().min(1),
  changesSummary: z.string().optional(),
}).strict();

export const signConsentSchema = z.object({
  method: z.enum(['OTP_EMAIL', 'GRAPHOMETRIC']),
  otpReference: uuid.optional(),
  otpCode: z.string().length(6).optional(),
  signatureImageData: z.string().optional(),
  signedAt: z.string().datetime(),
  deviceFingerprint: deviceFingerprintSchema,
  geolocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
  }).optional(),
}).strict();

export const revokeConsentSchema = z.object({
  reason: z.string().trim().min(1),
}).strict();

export const requestOTPSchema = z.object({
  deviceFingerprint: deviceFingerprintSchema,
}).strict();

export const consentStatusSchema = z.enum([
  'draft',
  'awaiting_doctor_signature',
  'doctor_signed',
  'awaiting_clinic_signature',
  'clinic_signed',
  'awaiting_client_signature',
  'fully_signed',
  'revoked',
]);

export const consentTemplateRowSchema = z.object({
  id: uuid,
  owner_id: uuid,
  owner_type: z.enum(['medico', 'estetista']),
  company_id: uuid.nullable(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  treatment_types: z.array(z.string()).nullable(),
  content_html: z.string(),
  source: z.enum(['editor', 'uploaded']),
  requires_clinic_signature: z.boolean(),
  disclaimer_accepted: z.boolean(),
  disclaimer_accepted_at: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const consentDocumentRowSchema = z.object({
  id: uuid,
  template_id: uuid.nullable(),
  treatment_id: uuid,
  professional_id: uuid,
  client_id: uuid,
  company_id: uuid.nullable(),
  professional_role: z.string().nullable(),
  status: consentStatusSchema,
  current_version_id: uuid.nullable(),
  content_hash: z.string().nullable(),
  draft_created_at: z.string(),
  reviewed_at: z.string().nullable(),
  professional_signed_at: z.string().nullable(),
  clinic_signed_at: z.string().nullable(),
  client_signed_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  revoked_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const consentVersionRowSchema = z.object({
  id: uuid,
  consent_id: uuid,
  version_number: z.number(),
  content_html: z.string(),
  content_hash: z.string(),
  changes_summary: z.string().nullable(),
  created_by: uuid,
  created_at: z.string(),
});

export const consentSignatureRowSchema = z.object({
  id: uuid,
  consent_id: uuid,
  version_id: uuid,
  signer_id: uuid,
  signer_role: z.enum(['doctor', 'clinic', 'client']),
  signer_name: z.string(),
  signer_email: z.string().nullable(),
  method: z.enum(['OTP_EMAIL', 'GRAPHOMETRIC']),
  signed_at: z.string(),
  document_hash: z.string(),
  signature_hash: z.string(),
});

export type DeviceFingerprint = z.infer<typeof deviceFingerprintSchema>;
export type CreateConsentTemplateRequest = z.infer<typeof createConsentTemplateSchema>;
export type UpdateConsentTemplateRequest = z.infer<typeof updateConsentTemplateSchema>;
export type AddConsentVersionRequest = z.infer<typeof addConsentVersionSchema>;
export type SignConsentRequest = z.infer<typeof signConsentSchema>;
export type RevokeConsentRequest = z.infer<typeof revokeConsentSchema>;
export type RequestOTPRequest = z.infer<typeof requestOTPSchema>;
export type ConsentStatus = z.infer<typeof consentStatusSchema>;
export type ConsentTemplateRow = z.infer<typeof consentTemplateRowSchema>;
export type ConsentDocumentRow = z.infer<typeof consentDocumentRowSchema>;
export type ConsentVersionRow = z.infer<typeof consentVersionRowSchema>;
export type ConsentSignatureRow = z.infer<typeof consentSignatureRowSchema>;
