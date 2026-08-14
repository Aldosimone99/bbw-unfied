import { z } from 'zod';
import { registerableRoleSchema } from './auth-schema';

export const referralCodeSchema = z.string()
  .min(1)
  .transform((value) => value.trim().toUpperCase());

export const inviteRegistrationFieldsSchema = z.object({
  invite_code: z.string().trim().optional(),
  invite_token: z.string().trim().optional(),
  company_invite_token: z.string().trim().optional(),
  codice_riferimento: z.string().trim().optional(),
  clinic_code: z.string().trim().optional(),
  professional_code: z.string().trim().optional(),
}).strict();

export const inviteLookupResponseSchema = z.object({
  valid: z.boolean(),
  code: z.string(),
  email: z.string().email(),
  nome: z.string().nullable().optional(),
  cognome: z.string().nullable().optional(),
  role: registerableRoleSchema,
  expiresAt: z.string().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  companyName: z.string().nullable().optional(),
}).strict();

export const organizationInvitationRoleSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  displayName: z.string().min(1),
}).strict();

export const companyInviteLookupResponseSchema = z.object({
  organizationName: z.string().min(1),
  role: z.string().min(1),
  expiresAt: z.string(),
  status: z.literal('pending'),
}).strict();

export const companyInviteAcceptSchema = z.object({
  token: z.string().trim().min(1).max(512),
}).strict();

export const createCompanyInviteRequestSchema = z.object({
  email: z.string().trim().email(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
}).strict();

export const companyInviteRowSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: organizationInvitationRoleSchema,
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expiresAt: z.string(),
  createdAt: z.string(),
  invitedBy: z.string().uuid(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
}).strict();

export const companyInviteListResponseSchema = z.object({
  data: z.array(companyInviteRowSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
}).strict();

export const patientInvitationTypeSchema = z.literal('patient_relationship');

export const createPatientInvitationRequestSchema = z.object({
  email: z.string().trim().email(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
}).strict();

export const patientInvitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  createdAt: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
}).strict();

export const patientInvitationListResponseSchema = z.object({
  items: z.array(patientInvitationSchema),
  total: z.number().int().nonnegative(),
}).strict();

export const patientInvitationLinkResponseSchema = z.object({
  acceptLink: z.string().url(),
}).strict();

export const patientInvitationLookupResponseSchema = z.object({
  organizationName: z.string().min(1),
  expiresAt: z.string(),
  status: z.literal('pending'),
}).strict();

export const patientInvitationAcceptRequestSchema = z.object({
  token: z.string().trim().min(1).max(512),
}).strict();

export const patientInvitationAcceptResponseSchema = z.object({
  organizationName: z.string().min(1),
  relationshipId: z.string().uuid(),
  relationshipReactivated: z.boolean(),
}).strict();
export const referralContextQuerySchema = z.object({
  ref: z.string().trim().optional(),
  medico: z.string().trim().optional(),
  estetista: z.string().trim().optional(),
  clinica: z.string().trim().optional(),
  commerciale: z.string().trim().optional(),
}).strict();

export const createInviteRequestSchema = z.object({
  email: z.string().email(),
  type: registerableRoleSchema,
  nome: z.string().trim().optional(),
  cognome: z.string().trim().optional(),
  expires_in_days: z.number().int().min(1).max(30).optional(),
  force: z.boolean().optional(),
}).strict();

export const inviteRowSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  email: z.string().email(),
  type: registerableRoleSchema,
  status: z.enum(['pending', 'used', 'expired', 'revoked']),
  nome: z.string().nullable().optional(),
  cognome: z.string().nullable().optional(),
  created_at: z.string(),
  expires_at: z.string(),
  used_at: z.string().nullable().optional(),
  accept_token: z.string().nullable().optional(),
  acceptLink: z.string().url().optional(),
});

export const inviteListResponseSchema = z.object({
  data: z.array(inviteRowSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});

export type OrganizationInvitationRole = z.infer<typeof organizationInvitationRoleSchema>;
export type CreateCompanyInviteRequest = z.infer<typeof createCompanyInviteRequestSchema>;
export type CompanyInviteRow = z.infer<typeof companyInviteRowSchema>;
export type CompanyInviteListResponse = z.infer<typeof companyInviteListResponseSchema>;
export type CompanyInviteLookupResponse = z.infer<typeof companyInviteLookupResponseSchema>;
export type CompanyInviteAccept = z.infer<typeof companyInviteAcceptSchema>;
export type InviteRegistrationFields = z.infer<typeof inviteRegistrationFieldsSchema>;
export type InviteLookupResponse = z.infer<typeof inviteLookupResponseSchema>;
export type PatientInvitationType = z.infer<typeof patientInvitationTypeSchema>;
export type CreatePatientInvitationRequest = z.infer<typeof createPatientInvitationRequestSchema>;
export type PatientInvitation = z.infer<typeof patientInvitationSchema>;
export type PatientInvitationListResponse = z.infer<typeof patientInvitationListResponseSchema>;
export type PatientInvitationLinkResponse = z.infer<typeof patientInvitationLinkResponseSchema>;
export type PatientInvitationLookupResponse = z.infer<typeof patientInvitationLookupResponseSchema>;
export type PatientInvitationAcceptRequest = z.infer<typeof patientInvitationAcceptRequestSchema>;
export type PatientInvitationAcceptResponse = z.infer<typeof patientInvitationAcceptResponseSchema>;
export type ReferralContextQuery = z.infer<typeof referralContextQuerySchema>;

export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;
export type InviteRow = z.infer<typeof inviteRowSchema>;
export type InviteListResponse = z.infer<typeof inviteListResponseSchema>;
