import { Router, type Request } from 'express';
import { professionalDocumentUploadSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { createDeferredUpload, uploadProfessionalDocument } from '../services/professional-documents-service';

interface RouteUser {
  id: string;
  tipo_utente?: string | null;
}

type ResolveUser = (req: Request) => RouteUser | null | Promise<RouteUser | null>;

export function createProfessionalDocumentsRouter(db: SupabaseLike, resolveUser: ResolveUser): Router {
  const router = Router();
  router.post('/upload', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    const parsed = professionalDocumentUploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    try {
      const data = await uploadProfessionalDocument(db, {
        userId: user.id,
        professionalType: String(user.tipo_utente || 'professional'),
        type: parsed.data.type,
        fileName: parsed.data.fileName,
        fileMime: parsed.data.fileMime,
        fileData: parsed.data.fileData,
      });
      return res.json({ success: true, data });
    } catch (error) {
      if (String(error instanceof Error ? error.message : error).includes('PAYLOAD_TOO_LARGE')) {
        const deferred = await createDeferredUpload(db, {
          userId: user.id,
          documentType: parsed.data.type,
          fileName: parsed.data.fileName,
          fileMime: parsed.data.fileMime,
          fileSizeBytes: parsed.data.fileData.length,
          errorMessage: 'Payload too large',
        });
        return res.status(202).json({ success: true, deferred: true, data: deferred });
      }
      return res.status(500).json({ success: false, error: 'DOCUMENT_UPLOAD_FAILED' });
    }
  });
  return router;
}
