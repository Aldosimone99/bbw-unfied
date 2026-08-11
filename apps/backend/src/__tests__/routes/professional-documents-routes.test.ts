import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createProfessionalDocumentsRouter } from '../../routes/professional-documents-routes';

const user = { id: 'user-1', email: 'doctor@example.com', tipo_utente: 'medico' };

function mockDb() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'verification-1' } }),
      insert: vi.fn().mockReturnValue({ error: null }),
    })),
  };
}

describe('professional document routes', () => {
  it('uploads document metadata for authenticated professional', async () => {
    const app = express().use(express.json()).use('/professional-documents', createProfessionalDocumentsRouter(mockDb(), () => user));

    const res = await request(app).post('/professional-documents/upload').send({
      type: 'identity',
      fileName: 'documento.pdf',
      fileMime: 'application/pdf',
      fileData: 'data:application/pdf;base64,JVBERi0=',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ type: 'identity', status: 'pending' });
  });
});
