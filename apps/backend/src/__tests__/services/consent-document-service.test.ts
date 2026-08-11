import { describe, expect, it, vi } from 'vitest';
import {
  addVersion,
  advanceFSM,
  ConsentDocumentError,
  createForTreatment,
  generateShareToken,
} from '../../services/consent-document-service';

const ids = {
  template: '11111111-1111-4111-8111-111111111111',
  treatment: '22222222-2222-4222-8222-222222222222',
  professional: '33333333-3333-4333-8333-333333333333',
  client: '44444444-4444-4444-8444-444444444444',
  company: '55555555-5555-4555-8555-555555555555',
};

function dbMock() {
  const state = {
    consent_templates: [{ id: ids.template, content_html: '<p>Consent</p>', requires_clinic_signature: true, name: 'Template' }],
    consent_documents: [] as any[],
    consent_document_versions: [] as any[],
    consent_audit_logs: [] as any[],
    consent_share_tokens: [] as any[],
    users: [{ id: ids.client, email: 'client@example.com', nome: 'Ada', cognome: 'Rossi' }],
    message_threads: [] as any[],
    message_messages: [] as any[],
  };
  return { state, from: vi.fn((table: keyof typeof state) => query(state, table)) } as any;
}

function query(state: any, table: string) {
  const filters: Array<(row: any) => boolean> = [];
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((field: string, value: unknown) => {
      filters.push((row) => row[field] === value);
      return builder;
    }),
    maybeSingle: vi.fn(async () => ({ data: state[table].find((row: any) => filters.every((fn) => fn(row))) ?? null, error: null })),
    single: vi.fn(async () => ({ data: builder._last, error: builder._last ? null : { message: 'missing' } })),
    insert: vi.fn((payload: any) => {
      builder._last = { id: `${table}-${state[table].length + 1}`, created_at: 'now', updated_at: 'now', ...payload };
      state[table].push(builder._last);
      return builder;
    }),
    update: vi.fn((payload: any) => {
      const row = state[table].find((item: any) => filters.every((fn) => fn(item)));
      if (row) Object.assign(row, payload);
      builder._last = row;
      return builder;
    }),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
  };
  builder.then = (resolve: any) => resolve({ data: state[table].filter((row: any) => filters.every((fn) => fn(row))), count: state[table].length, error: null });
  return builder;
}

describe('consent-document-service', () => {
  it('creates document, version 1, audit log, and awaiting doctor status', async () => {
    const db = dbMock();
    const doc = await createForTreatment(db, {
      templateId: ids.template,
      treatmentId: ids.treatment,
      professionalId: ids.professional,
      clientId: ids.client,
      companyId: ids.company,
      professionalRole: 'medico',
    }, { messagingService: { getOrCreateNotificationThread: vi.fn().mockResolvedValue('thread-1'), insertSystemMessage: vi.fn() } as any });

    expect(doc.status).toBe('awaiting_doctor_signature');
    expect(db.state.consent_document_versions).toHaveLength(1);
    expect(db.state.consent_audit_logs[0]).toMatchObject({ event_type: 'consent_created', new_status: 'awaiting_doctor_signature' });
  });

  it('blocks adding a version after doctor signature', async () => {
    const db = dbMock();
    db.state.consent_documents.push({ id: 'doc-1', professional_id: ids.professional, status: 'doctor_signed' });
    await expect(addVersion(db, 'doc-1', ids.professional, { contentHtml: '<p>v2</p>' }))
      .rejects.toMatchObject({ code: 'DOCUMENT_NOT_EDITABLE', statusCode: 409 });
  });

  it('advances doctor signature to clinic signature when required', async () => {
    const db = dbMock();
    db.state.consent_documents.push({ id: 'doc-1', template_id: ids.template, company_id: ids.company, status: 'awaiting_doctor_signature' });
    const doc = await advanceFSM(db, 'doc-1', 'doctor', 'sig-1', 'Dr Bianchi', 'doctor');
    expect(doc.status).toBe('awaiting_clinic_signature');
  });

  it('generates share token only while awaiting client signature', async () => {
    const db = dbMock();
    db.state.consent_documents.push({ id: 'doc-1', client_id: ids.client, professional_id: ids.professional, status: 'awaiting_doctor_signature' });
    await expect(generateShareToken(db, 'doc-1', ids.professional, { sendConsentShareEmail: vi.fn() } as any))
      .rejects.toBeInstanceOf(ConsentDocumentError);
    db.state.consent_documents[0].status = 'awaiting_client_signature';
    await expect(generateShareToken(db, 'doc-1', ids.professional, { sendConsentShareEmail: vi.fn() } as any, { tokenFactory: () => 'token' }))
      .resolves.toMatchObject({ token: 'token' });
  });
});
