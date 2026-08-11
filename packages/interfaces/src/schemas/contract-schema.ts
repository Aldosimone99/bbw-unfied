import { z } from 'zod';

export const contractTypeSchema = z.enum(['professional', 'commerciale']);
export const contractStateSchema = z.enum([
  'pending_signature',
  'signed',
  'deferred',
  'pending_countersignature',
  'countersigned',
  'rejected',
]);

export const contractSignRequestSchema = z.object({
  signatureImageData: z.string().startsWith('data:image/png;base64,').optional(),
  useStoredSignature: z.boolean().optional(),
  source: z.string().optional(),
}).superRefine((payload, ctx) => {
  if (!payload.useStoredSignature && !payload.signatureImageData) {
    ctx.addIssue({ code: 'custom', path: ['signatureImageData'], message: 'signature image is required' });
  }
});

export const contractStatusSchema = z.object({
  contractType: contractTypeSchema,
  contractRole: z.string(),
  state: contractStateSchema,
  isSigned: z.boolean(),
  documentRef: z.string(),
  documentVersion: z.string(),
  documentPath: z.string(),
  signedAt: z.string().nullable(),
  dueAt: z.string().nullable(),
  canOperate: z.boolean(),
}).strict();

export type ContractSignRequest = z.infer<typeof contractSignRequestSchema>;
export type ContractStatus = z.infer<typeof contractStatusSchema>;
