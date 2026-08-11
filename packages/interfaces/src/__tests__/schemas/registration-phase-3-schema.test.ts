import { describe, expect, it } from 'vitest';
import {
  contractSignRequestSchema,
  contractStatusSchema,
} from '../../schemas/contract-schema';
import {
  professionalDocumentUploadSchema,
  deferredDocumentUploadSchema,
} from '../../schemas/document-schema';
import { onboardingStatusSchema } from '../../schemas/onboarding-schema';

describe('Registration Phase 3 Schemas', () => {
  it('accepts graphometric contract signature requests', () => {
    const result = contractSignRequestSchema.safeParse({
      signatureImageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      source: 'graphometric',
    });
    expect(result.success).toBe(true);
  });

  it('accepts contract status responses', () => {
    const result = contractStatusSchema.safeParse({
      contractType: 'professional',
      contractRole: 'medico',
      state: 'signed',
      isSigned: true,
      documentRef: 'CON-001',
      documentVersion: '1.0',
      documentPath: '/contracts/CON-001.pdf',
      signedAt: '2025-01-15T10:00:00Z',
      dueAt: null,
      canOperate: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts professional document upload metadata', () => {
    const result = professionalDocumentUploadSchema.safeParse({
      type: 'identity',
      fileName: 'documento.pdf',
      fileMime: 'application/pdf',
      fileData: 'base64-encoded-content',
    });
    expect(result.success).toBe(true);
  });

  it('accepts deferred upload records', () => {
    const result = deferredDocumentUploadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      documentType: 'identity',
      fileName: 'documento.pdf',
      status: 'pending',
    });
    expect(result.success).toBe(true);
  });

  it('accepts onboarding status responses', () => {
    const result = onboardingStatusSchema.safeParse({
      role: 'medico',
      completed: false,
      steps: [
        { id: 'profile', label: 'Complete profile', complete: true, blocking: false },
        { id: 'documents', label: 'Upload documents', complete: false, blocking: true },
      ],
    });
    expect(result.success).toBe(true);
  });
});
