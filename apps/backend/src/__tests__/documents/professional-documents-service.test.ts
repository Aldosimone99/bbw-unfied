import { describe, expect, it, vi } from 'vitest';
import { createDeferredUpload, uploadProfessionalDocument } from '../../services/professional-documents-service';

function makeDb(inserts: unknown[] = [], verification: { id: string } | null = { id: 'verification-1' }) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: table === 'professional_verifications' ? verification : null }),
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return { error: null, data: payload };
      }),
      upsert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return { error: null, data: payload };
      }),
    })),
  };
}

describe('professional document service', () => {
  it('creates verification row and verification document', async () => {
    const inserts: unknown[] = [];
    await uploadProfessionalDocument(makeDb(inserts, null), {
      userId: 'user-1',
      professionalType: 'medico',
      type: 'identity',
      fileName: 'documento.pdf',
      fileMime: 'application/pdf',
      fileData: 'data:application/pdf;base64,JVBERi0=',
    });
    expect(inserts).toContainEqual(expect.objectContaining({ table: 'professional_verifications' }));
    expect(inserts).toContainEqual(expect.objectContaining({ table: 'verification_documents' }));
  });

  it('creates deferred upload records for oversized payloads', async () => {
    const inserts: unknown[] = [];
    await createDeferredUpload(makeDb(inserts), {
      userId: 'user-1',
      documentType: 'insurance',
      fileName: 'polizza.pdf',
      fileMime: 'application/pdf',
      fileSizeBytes: 20_000_000,
      errorMessage: 'Payload too large',
    });
    expect(inserts).toContainEqual(expect.objectContaining({
      table: 'deferred_document_uploads',
      payload: expect.objectContaining({ document_type: 'insurance', status: 'pending' }),
    }));
  });
});
