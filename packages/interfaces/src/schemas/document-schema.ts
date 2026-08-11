import { z } from 'zod';

export const professionalDocumentTypeSchema = z.enum(['identity', 'insurance', 'albo', 'asl']);
export const documentStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const deferredUploadStatusSchema = z.enum(['pending', 'completed', 'failed']);

export const professionalDocumentUploadSchema = z.object({
  type: professionalDocumentTypeSchema,
  fileName: z.string().min(1),
  fileMime: z.string().min(1),
  fileData: z.string().min(1),
}).strict();

export const professionalDocumentSchema = z.object({
  id: z.string().uuid(),
  type: professionalDocumentTypeSchema,
  name: z.string(),
  url: z.string(),
  status: documentStatusSchema,
  uploadedAt: z.string(),
  rejectionReason: z.string().nullable().optional(),
}).strict();

export const deferredDocumentUploadSchema = z.object({
  id: z.string().uuid(),
  documentType: professionalDocumentTypeSchema,
  fileName: z.string(),
  status: deferredUploadStatusSchema,
}).strict();

export type ProfessionalDocumentUpload = z.infer<typeof professionalDocumentUploadSchema>;
export type ProfessionalDocument = z.infer<typeof professionalDocumentSchema>;
export type DeferredDocumentUpload = z.infer<typeof deferredDocumentUploadSchema>;
