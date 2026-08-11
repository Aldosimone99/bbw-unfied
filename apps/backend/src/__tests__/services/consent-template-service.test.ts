import { describe, expect, it, vi } from 'vitest';
import {
  ConsentTemplateError,
  createTemplate,
  deactivateTemplate,
  updateTemplate,
} from '../../services/consent-template-service';

const ownerId = '11111111-1111-4111-8111-111111111111';

function dbMock() {
  const state = { consent_templates: [] as any[], consent_documents: [] as any[] };
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
    is: vi.fn((field: string, value: null) => {
      filters.push((row) => row[field] === value);
      return builder;
    }),
    maybeSingle: vi.fn(async () => ({ data: state[table].find((row: any) => filters.every((fn) => fn(row))) ?? null, error: null })),
    single: vi.fn(async () => ({ data: builder._last, error: builder._last ? null : { message: 'missing' } })),
    insert: vi.fn((payload: any) => {
      builder._last = { id: 'template-1', created_at: 'now', updated_at: 'now', ...payload };
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

describe('consent-template-service', () => {
  it('creates editor templates and stores disclaimer timestamp', async () => {
    const db = dbMock();
    const template = await createTemplate(db, {
      ownerId,
      ownerType: 'medico',
      companyId: null,
      name: 'Consenso',
      category: 'laser',
      contentHtml: '<p>Testo</p>',
      source: 'editor',
      disclaimerAccepted: true,
    });

    expect(template).toMatchObject({
      owner_id: ownerId,
      source: 'editor',
      requires_clinic_signature: true,
      disclaimer_accepted: true,
    });
  });

  it('rejects empty html', async () => {
    await expect(createTemplate(dbMock(), {
      ownerId,
      ownerType: 'medico',
      companyId: null,
      name: 'Consenso',
      category: 'laser',
      contentHtml: '',
      source: 'editor',
      disclaimerAccepted: true,
    })).rejects.toBeInstanceOf(ConsentTemplateError);
  });

  it('blocks content changes and deactivation when template is in use', async () => {
    const db = dbMock();
    db.state.consent_templates.push({ id: 'template-1', owner_id: ownerId, content_html: '<p>Old</p>', is_active: true });
    db.state.consent_documents.push({ id: 'doc-1', template_id: 'template-1' });

    await expect(updateTemplate(db, 'template-1', ownerId, { contentHtml: '<p>New</p>' }))
      .rejects.toMatchObject({ code: 'TEMPLATE_IN_USE', statusCode: 409 });
    await expect(deactivateTemplate(db, 'template-1', ownerId))
      .rejects.toMatchObject({ code: 'TEMPLATE_IN_USE', statusCode: 409 });
  });
});
