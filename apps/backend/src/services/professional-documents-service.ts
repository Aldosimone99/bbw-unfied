import type { SupabaseLike } from '../db/supabase';

type DocumentType = 'identity' | 'insurance' | 'albo' | 'asl';

interface UploadProfessionalDocumentInput {
  userId: string;
  professionalType: string;
  type: DocumentType;
  fileName: string;
  fileMime: string;
  fileData: string;
}

interface DeferredUploadInput {
  userId: string;
  documentType: DocumentType;
  fileName: string;
  fileMime: string;
  fileSizeBytes: number;
  errorMessage?: string;
}

function buildDocumentUrl(userId: string, type: string, fileName: string): string {
  const safeFile = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  return `/uploads/professional-documents/${userId}/${type}/${safeFile}`;
}

async function ensureVerification(db: SupabaseLike, userId: string, professionalType: string): Promise<string> {
  const { data } = await db.from('professional_verifications')
    .select('id')
    .eq('user_id', userId)
    .eq('professional_type', professionalType)
    .maybeSingle();
  if ((data as { id?: string } | null)?.id) return String((data as { id: string }).id);

  const generatedId = crypto.randomUUID();
  const { error } = await db.from('professional_verifications').insert({
    id: generatedId,
    user_id: userId,
    professional_type: professionalType,
    status: 'pending',
    last_update: new Date().toISOString(),
  });
  if (error) throw new Error('PROFESSIONAL_VERIFICATION_CREATE_FAILED');
  return generatedId;
}

export async function uploadProfessionalDocument(db: SupabaseLike, input: UploadProfessionalDocumentInput) {
  const verificationId = await ensureVerification(db, input.userId, input.professionalType);
  const url = buildDocumentUrl(input.userId, input.type, input.fileName);
  const { error } = await db.from('verification_documents').insert({
    verification_id: verificationId,
    name: input.fileName,
    type: input.type,
    url,
    status: 'pending',
  });
  if (error) throw new Error('VERIFICATION_DOCUMENT_CREATE_FAILED');
  return { type: input.type, name: input.fileName, url, status: 'pending' as const };
}

export async function createDeferredUpload(db: SupabaseLike, input: DeferredUploadInput) {
  const { error } = await db.from('deferred_document_uploads').insert({
    user_id: input.userId,
    document_type: input.documentType,
    file_name: input.fileName,
    file_mime: input.fileMime,
    file_size_bytes: input.fileSizeBytes,
    status: 'pending',
    error_message: input.errorMessage,
  });
  if (error) throw new Error('DEFERRED_UPLOAD_CREATE_FAILED');
  return { status: 'pending' as const };
}
