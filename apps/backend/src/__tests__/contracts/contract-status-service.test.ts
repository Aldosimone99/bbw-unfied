import { describe, expect, it, vi } from 'vitest';
import { getCommercialeContractStatus, signCommercialeContract } from '../../services/commerciale-contract-service';
import { getProfessionalContractStatus, signProfessionalContract } from '../../services/professional-contract-service';

function makeDb(signatureRows: unknown[] = [], inserts: unknown[] = []) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: table === 'contract_signatures' ? signatureRows[0] ?? null : null,
      }),
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return { error: null };
      }),
    })),
  };
}

describe('contract status services', () => {
  it('returns pending commerciale status before signature', async () => {
    const status = await getCommercialeContractStatus(makeDb(), { id: 'user-1', email: 'seller@example.com', tipo_utente: 'commerciale' });
    expect(status).toMatchObject({ contractType: 'commerciale', state: 'pending_signature', isSigned: false });
  });

  it('records commerciale signature and returns signed status', async () => {
    const inserts: unknown[] = [];
    await signCommercialeContract(makeDb([], inserts), {
      user: { id: 'user-1', email: 'seller@example.com', tipo_utente: 'commerciale' },
      signatureImageData: 'data:image/png;base64,iVBORw0KGgo=',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(inserts).toContainEqual(expect.objectContaining({ table: 'contract_signatures' }));
  });

  it('returns professional contract profile by role', async () => {
    const status = await getProfessionalContractStatus(makeDb(), { id: 'user-1', email: 'doctor@example.com', tipo_utente: 'medico' });
    expect(status).toMatchObject({ contractType: 'professional', contractRole: 'medico' });
  });

  it('records professional signature', async () => {
    const inserts: unknown[] = [];
    await signProfessionalContract(makeDb([], inserts), {
      user: { id: 'user-1', email: 'doctor@example.com', tipo_utente: 'medico' },
      signatureImageData: 'data:image/png;base64,iVBORw0KGgo=',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(inserts).toContainEqual(expect.objectContaining({ table: 'contract_signatures' }));
  });
});
