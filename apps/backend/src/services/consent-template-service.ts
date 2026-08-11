import type { SupabaseLike } from '../db/supabase';

export class ConsentTemplateError extends Error {
  constructor(public code: string, public statusCode: number, message = code) {
    super(message);
  }
}

export type ConsentTemplateRow = {
  id: string;
  owner_id: string;
  owner_type: 'medico' | 'estetista';
  company_id: string | null;
  name: string;
  description: string | null;
  category: string;
  treatment_types: string[] | null;
  content_html: string;
  source: 'editor' | 'uploaded';
  requires_clinic_signature: boolean;
  disclaimer_accepted: boolean;
  disclaimer_accepted_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Page = { page: number; limit: number };

async function templateInUse(db: SupabaseLike, templateId: string): Promise<boolean> {
  const { data } = await db.from('consent_documents').select('id').eq('template_id', templateId).maybeSingle();
  return Boolean(data);
}

async function getOwnedTemplate(db: SupabaseLike, templateId: string, actorId: string): Promise<ConsentTemplateRow> {
  const { data } = await db.from('consent_templates').select('*').eq('id', templateId).maybeSingle();
  if (!data) throw new ConsentTemplateError('TEMPLATE_NOT_FOUND', 404);
  const row = data as ConsentTemplateRow;
  if (row.owner_id !== actorId) throw new ConsentTemplateError('TEMPLATE_FORBIDDEN', 403);
  return row;
}

export async function createTemplate(db: SupabaseLike, payload: {
  ownerId: string;
  ownerType: 'medico' | 'estetista';
  companyId: string | null;
  name: string;
  description?: string;
  category: string;
  treatmentTypes?: string[];
  contentHtml: string;
  source: 'editor' | 'uploaded';
  requiresClinicSignature?: boolean;
  disclaimerAccepted: boolean;
}): Promise<ConsentTemplateRow> {
  if (!payload.contentHtml.trim()) throw new ConsentTemplateError('TEMPLATE_CONTENT_REQUIRED', 400);
  const now = new Date().toISOString();
  const { data, error } = await db.from('consent_templates').insert({
    owner_id: payload.ownerId,
    owner_type: payload.ownerType,
    company_id: payload.companyId,
    name: payload.name,
    description: payload.description ?? null,
    category: payload.category,
    treatment_types: payload.treatmentTypes ?? [],
    content_html: payload.contentHtml,
    source: payload.source,
    requires_clinic_signature: payload.requiresClinicSignature ?? true,
    disclaimer_accepted: payload.disclaimerAccepted,
    disclaimer_accepted_at: payload.disclaimerAccepted ? now : null,
    is_active: true,
    updated_at: now,
  }).select('*').single();
  if (error || !data) throw new ConsentTemplateError('TEMPLATE_CREATE_FAILED', 500);
  return data as ConsentTemplateRow;
}

export async function listTemplates(db: SupabaseLike, ownerId: string, companyId: string | null, pagination: Page) {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = db.from('consent_templates').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  query = companyId ? query.eq('company_id', companyId) : query.eq('owner_id', ownerId).is('company_id', null);
  const { data, count, error } = await query;
  if (error) throw new ConsentTemplateError('TEMPLATE_LIST_FAILED', 500);
  const total = count ?? 0;
  return { data: (data ?? []) as ConsentTemplateRow[], total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getTemplate(db: SupabaseLike, templateId: string, actorId: string): Promise<ConsentTemplateRow> {
  const { data } = await db.from('consent_templates').select('*').eq('id', templateId).maybeSingle();
  if (!data) throw new ConsentTemplateError('TEMPLATE_NOT_FOUND', 404);
  const row = data as ConsentTemplateRow;
  if (row.owner_id === actorId) return row;
  if (row.company_id) {
    const { data: member } = await db.from('company_members').select('id').eq('company_id', row.company_id).eq('user_id', actorId).eq('is_active', true).maybeSingle();
    if (member) return row;
  }
  throw new ConsentTemplateError('TEMPLATE_FORBIDDEN', 403);
}

export async function updateTemplate(db: SupabaseLike, templateId: string, actorId: string, payload: Partial<{
  name: string;
  description: string;
  category: string;
  treatmentTypes: string[];
  contentHtml: string;
  requiresClinicSignature: boolean;
  disclaimerAccepted: boolean;
}>): Promise<ConsentTemplateRow> {
  const existing = await getOwnedTemplate(db, templateId, actorId);
  if (payload.contentHtml && payload.contentHtml !== existing.content_html && await templateInUse(db, templateId)) {
    throw new ConsentTemplateError('TEMPLATE_IN_USE', 409);
  }
  const now = new Date().toISOString();
  const { data, error } = await db.from('consent_templates').update({
    name: payload.name,
    description: payload.description,
    category: payload.category,
    treatment_types: payload.treatmentTypes,
    content_html: payload.contentHtml,
    requires_clinic_signature: payload.requiresClinicSignature,
    disclaimer_accepted: payload.disclaimerAccepted,
    disclaimer_accepted_at: payload.disclaimerAccepted ? now : undefined,
    updated_at: now,
  }).eq('id', templateId).eq('owner_id', actorId).select('*').single();
  if (error || !data) throw new ConsentTemplateError('TEMPLATE_UPDATE_FAILED', 500);
  return data as ConsentTemplateRow;
}

export async function deactivateTemplate(db: SupabaseLike, templateId: string, actorId: string): Promise<void> {
  await getOwnedTemplate(db, templateId, actorId);
  if (await templateInUse(db, templateId)) throw new ConsentTemplateError('TEMPLATE_IN_USE', 409);
  const { error } = await db.from('consent_templates').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', templateId).eq('owner_id', actorId);
  if (error) throw new ConsentTemplateError('TEMPLATE_DEACTIVATE_FAILED', 500);
}
