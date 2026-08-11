import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseLike } from '../db/supabase';
import type { EmailService } from './email-service';
import { getOrCreateNotificationThread, insertSystemMessage } from './messaging-service';

export class ConsentDocumentError extends Error {
  constructor(public code: string, public statusCode: number, message = code) {
    super(message);
  }
}

export type ConsentStatus =
  | 'draft'
  | 'awaiting_doctor_signature'
  | 'doctor_signed'
  | 'awaiting_clinic_signature'
  | 'clinic_signed'
  | 'awaiting_client_signature'
  | 'fully_signed'
  | 'revoked';

export type ConsentDocumentRow = {
  id: string;
  template_id: string | null;
  treatment_id: string;
  professional_id: string;
  client_id: string;
  company_id: string | null;
  professional_role: string | null;
  status: ConsentStatus;
  current_version_id: string | null;
  content_hash: string | null;
  revoked_reason?: string | null;
};

type MessagingServiceLike = {
  getOrCreateNotificationThread: typeof getOrCreateNotificationThread;
  insertSystemMessage: typeof insertSystemMessage;
};

const defaultMessagingService: MessagingServiceLike = { getOrCreateNotificationThread, insertSystemMessage };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function audit(db: SupabaseLike, input: {
  consentId: string;
  versionId?: string | null;
  signatureId?: string | null;
  actorId?: string | null;
  actorRole: string;
  actorName: string;
  eventType: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  eventData?: Record<string, unknown>;
}) {
  await db.from('consent_audit_logs').insert({
    consent_id: input.consentId,
    version_id: input.versionId ?? null,
    signature_id: input.signatureId ?? null,
    actor_id: input.actorId ?? null,
    actor_role: input.actorRole,
    actor_name: input.actorName,
    event_type: input.eventType,
    event_data: input.eventData ?? null,
    previous_status: input.previousStatus ?? null,
    new_status: input.newStatus ?? null,
  });
}

async function getDoc(db: SupabaseLike, documentId: string): Promise<ConsentDocumentRow> {
  const { data } = await db.from('consent_documents').select('*').eq('id', documentId).maybeSingle();
  if (!data) throw new ConsentDocumentError('DOCUMENT_NOT_FOUND', 404);
  return data as ConsentDocumentRow;
}

export async function createForTreatment(db: SupabaseLike, payload: {
  templateId: string;
  treatmentId: string;
  professionalId: string;
  clientId: string;
  companyId: string | null;
  professionalRole?: string;
}, options: { messagingService?: MessagingServiceLike } = {}): Promise<ConsentDocumentRow> {
  const { data: template } = await db.from('consent_templates').select('*').eq('id', payload.templateId).maybeSingle();
  if (!template) throw new ConsentDocumentError('TEMPLATE_NOT_FOUND', 404);
  const contentHtml = String((template as any).content_html);
  const contentHash = sha256(contentHtml);

  const { data: docData, error: docError } = await db.from('consent_documents').insert({
    template_id: payload.templateId,
    treatment_id: payload.treatmentId,
    professional_id: payload.professionalId,
    client_id: payload.clientId,
    company_id: payload.companyId,
    professional_role: payload.professionalRole ?? null,
    status: 'draft',
    content_hash: contentHash,
  }).select('*').single();
  if (docError || !docData) throw new ConsentDocumentError('DOCUMENT_CREATE_FAILED', 500);
  const doc = docData as ConsentDocumentRow;

  const { data: versionData, error: versionError } = await db.from('consent_document_versions').insert({
    consent_id: doc.id,
    version_number: 1,
    content_html: contentHtml,
    content_hash: contentHash,
    changes_summary: 'Initial template snapshot',
    created_by: payload.professionalId,
  }).select('*').single();
  if (versionError || !versionData) throw new ConsentDocumentError('VERSION_CREATE_FAILED', 500);

  const { data: updatedData, error: updateError } = await db.from('consent_documents').update({
    current_version_id: (versionData as any).id,
    content_hash: contentHash,
    status: 'awaiting_doctor_signature',
    updated_at: new Date().toISOString(),
  }).eq('id', doc.id).select('*').single();
  if (updateError || !updatedData) throw new ConsentDocumentError('DOCUMENT_UPDATE_FAILED', 500);

  await audit(db, {
    consentId: doc.id,
    versionId: (versionData as any).id,
    actorId: payload.professionalId,
    actorRole: 'system',
    actorName: 'Beauty Broker World',
    eventType: 'consent_created',
    previousStatus: 'draft',
    newStatus: 'awaiting_doctor_signature',
  });

  const messaging = options.messagingService ?? defaultMessagingService;
  const threadId = await messaging.getOrCreateNotificationThread(db, [payload.professionalId]);
  await messaging.insertSystemMessage(db, threadId, payload.professionalId, 'consent_awaiting_signature', {
    consentId: doc.id,
    patientName: 'Paziente',
    treatmentName: String((template as any).name ?? 'trattamento'),
  });

  return updatedData as ConsentDocumentRow;
}

export async function getDocument(db: SupabaseLike, documentId: string, actorId: string) {
  const doc = await getDoc(db, documentId);
  if (doc.professional_id !== actorId && doc.client_id !== actorId) {
    if (!doc.company_id) throw new ConsentDocumentError('DOCUMENT_FORBIDDEN', 403);
    const { data: member } = await db.from('company_members').select('id').eq('company_id', doc.company_id).eq('user_id', actorId).eq('is_active', true).maybeSingle();
    if (!member) throw new ConsentDocumentError('DOCUMENT_FORBIDDEN', 403);
  }
  const { data: version } = await db.from('consent_document_versions').select('*').eq('id', doc.current_version_id).maybeSingle();
  const { data: signatures } = await db.from('consent_signatures').select('*').eq('consent_id', documentId);
  return { ...doc, current_version: version ?? null, signatures: signatures ?? [] };
}

export async function getDocumentByToken(db: SupabaseLike, token: string) {
  const { data: tokenRow } = await db.from('consent_share_tokens').select('*').eq('token', token).maybeSingle();
  if (!tokenRow) throw new ConsentDocumentError('TOKEN_NOT_FOUND', 404);
  if (new Date((tokenRow as any).expires_at).getTime() < Date.now()) throw new ConsentDocumentError('TOKEN_EXPIRED', 410);
  return getDocument(db, (tokenRow as any).consent_id, '');
}

export async function listDocuments(db: SupabaseLike, actorId: string, actorRole: string, companyId: string | null, filters: { status?: string; page: number; limit: number }) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = db.from('consent_documents').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (filters.status) query = query.eq('status', filters.status);
  if (['owner', 'admin', 'staff'].includes(actorRole) && companyId) query = query.eq('company_id', companyId);
  else if (actorRole === 'cliente' || actorRole === 'paciente') query = query.eq('client_id', actorId);
  else query = query.eq('professional_id', actorId);
  const { data, count, error } = await query;
  if (error) throw new ConsentDocumentError('DOCUMENT_LIST_FAILED', 500);
  const total = count ?? 0;
  return { data: data ?? [], total, page, limit, pages: Math.ceil(total / limit) };
}

export async function addVersion(db: SupabaseLike, documentId: string, actorId: string, payload: { contentHtml: string; changesSummary?: string }) {
  const doc = await getDoc(db, documentId);
  if (doc.professional_id !== actorId) throw new ConsentDocumentError('DOCUMENT_FORBIDDEN', 403);
  if (!['draft', 'awaiting_doctor_signature'].includes(doc.status)) throw new ConsentDocumentError('DOCUMENT_NOT_EDITABLE', 409);
  const { data: versions } = await db.from('consent_document_versions').select('*').eq('consent_id', documentId).order('version_number', { ascending: false });
  const versionNumber = ((versions ?? [])[0]?.version_number ?? 0) + 1;
  const contentHash = sha256(payload.contentHtml);
  const { data, error } = await db.from('consent_document_versions').insert({
    consent_id: documentId,
    version_number: versionNumber,
    content_html: payload.contentHtml,
    content_hash: contentHash,
    changes_summary: payload.changesSummary ?? null,
    created_by: actorId,
  }).select('*').single();
  if (error || !data) throw new ConsentDocumentError('VERSION_CREATE_FAILED', 500);
  await db.from('consent_documents').update({ current_version_id: (data as any).id, content_hash: contentHash, updated_at: new Date().toISOString() }).eq('id', documentId);
  await audit(db, { consentId: documentId, versionId: (data as any).id, actorId, actorRole: 'doctor', actorName: 'Professionista', eventType: 'version_added', newStatus: doc.status });
  return data;
}

function buildShareLink(token: string): string {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/consents/sign/${token}`;
}

export async function generateShareToken(
  db: SupabaseLike,
  documentId: string,
  actorId: string,
  emailService: EmailService,
  options: { tokenFactory?: () => string; now?: () => Date } = {},
) {
  const doc = await getDoc(db, documentId);
  if (doc.professional_id !== actorId) throw new ConsentDocumentError('DOCUMENT_FORBIDDEN', 403);
  if (doc.status !== 'awaiting_client_signature') throw new ConsentDocumentError('WRONG_STATUS_FOR_SHARE', 409);
  const now = options.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  const token = options.tokenFactory?.() ?? randomUUID();
  const { error } = await db.from('consent_share_tokens').insert({ consent_id: documentId, token, created_by: actorId, expires_at: expiresAt });
  if (error) throw new ConsentDocumentError('SHARE_TOKEN_CREATE_FAILED', 500);
  const { data: client } = await db.from('users').select('email, nome, cognome').eq('id', doc.client_id).maybeSingle();
  await emailService.sendConsentShareEmail({
    to: String((client as any)?.email ?? ''),
    patientName: [((client as any)?.nome), ((client as any)?.cognome)].filter(Boolean).join(' '),
    professionalName: 'Professionista',
    shareLink: buildShareLink(token),
  });
  return { token, expiresAt };
}

export async function revokeDocument(db: SupabaseLike, documentId: string, actorId: string, reason: string): Promise<void> {
  const doc = await getDoc(db, documentId);
  if (doc.status === 'fully_signed') throw new ConsentDocumentError('DOCUMENT_ALREADY_SIGNED', 409);
  if (doc.professional_id !== actorId) throw new ConsentDocumentError('DOCUMENT_FORBIDDEN', 403);
  await db.from('consent_documents').update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_reason: reason, updated_at: new Date().toISOString() }).eq('id', documentId);
  await audit(db, { consentId: documentId, actorId, actorRole: 'doctor', actorName: 'Professionista', eventType: 'document_revoked', previousStatus: doc.status, newStatus: 'revoked', eventData: { reason } });
}

export async function advanceFSM(db: SupabaseLike, documentId: string, signerRole: 'doctor' | 'clinic' | 'client', signatureId: string, actorName: string, actorRole: string): Promise<ConsentDocumentRow> {
  const doc = await getDoc(db, documentId);
  const { data: template } = await db.from('consent_templates').select('*').eq('id', doc.template_id).maybeSingle();
  let next: ConsentStatus;
  if (doc.status === 'awaiting_doctor_signature' && signerRole === 'doctor') {
    next = (template as any)?.requires_clinic_signature && doc.company_id ? 'awaiting_clinic_signature' : 'awaiting_client_signature';
  } else if (doc.status === 'awaiting_clinic_signature' && signerRole === 'clinic') {
    next = 'awaiting_client_signature';
  } else if (doc.status === 'awaiting_client_signature' && signerRole === 'client') {
    next = 'fully_signed';
  } else {
    throw new ConsentDocumentError('INVALID_FSM_TRANSITION', 409);
  }
  const timestampColumn = signerRole === 'doctor' ? 'professional_signed_at' : signerRole === 'clinic' ? 'clinic_signed_at' : 'client_signed_at';
  const { data, error } = await db.from('consent_documents').update({ status: next, [timestampColumn]: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', documentId).select('*').single();
  if (error || !data) throw new ConsentDocumentError('FSM_UPDATE_FAILED', 500);
  await audit(db, { consentId: documentId, signatureId, actorRole, actorName, eventType: 'signature_recorded', previousStatus: doc.status, newStatus: next });
  return data as ConsentDocumentRow;
}
