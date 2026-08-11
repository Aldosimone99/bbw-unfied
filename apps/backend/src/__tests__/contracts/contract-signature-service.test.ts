import { describe, expect, it, vi } from 'vitest';
import { normalizePngSignatureDataUrl } from '../../services/signature-service';
import { recordContractSignature } from '../../services/contract-signature-service';

describe('signature evidence services', () => {
  it('accepts png data urls and rejects non-png signatures', () => {
    expect(normalizePngSignatureDataUrl(' data:image/png;base64,iVBORw0KGgo= ')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(() => normalizePngSignatureDataUrl('data:image/jpeg;base64,abc')).toThrow('SIGNATURE_INVALID');
  });

  it('records contract signatures with a hash', async () => {
    const inserts: unknown[] = [];
    const db = {
      from: vi.fn((table: string) => ({
        insert: vi.fn((payload: unknown) => {
          inserts.push({ table, payload });
          return { error: null };
        }),
      })),
    };

    await recordContractSignature(db, {
      userId: 'user-1',
      contractType: 'professional',
      contractRole: 'medico',
      documentRef: 'ui:medico-platform-contract',
      documentVersion: '2026-06-23',
      signerRole: 'professional',
      signatureImageData: 'data:image/png;base64,iVBORw0KGgo=',
      usedStoredSignature: false,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(inserts[0]).toMatchObject({
      table: 'contract_signatures',
      payload: expect.objectContaining({
        user_id: 'user-1',
        contract_type: 'professional',
        signature_hash: expect.any(String),
      }),
    });
  });
});
