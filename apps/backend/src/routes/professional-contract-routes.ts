import { Router, type Request } from 'express';
import { contractSignRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { getProfessionalContractStatus, signProfessionalContract } from '../services/professional-contract-service';
import type { ContractUser } from '../services/contract-profile-service';

type ResolveUser = (req: Request) => ContractUser | null | Promise<ContractUser | null>;

export function createProfessionalContractRouter(db: SupabaseLike, resolveUser: ResolveUser): Router {
  const router = Router();
  router.get('/status', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    const data = await getProfessionalContractStatus(db, user);
    if (!data) return res.status(404).json({ error: 'CONTRACT_NOT_AVAILABLE' });
    return res.json({ success: true, data });
  });
  router.post('/sign', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    const parsed = contractSignRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    const data = await signProfessionalContract(db, {
      user,
      signatureImageData: parsed.data.signatureImageData,
      usedStoredSignature: parsed.data.useStoredSignature,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    if (!data) return res.status(404).json({ error: 'CONTRACT_NOT_AVAILABLE' });
    return res.json({ success: true, data });
  });
  return router;
}
