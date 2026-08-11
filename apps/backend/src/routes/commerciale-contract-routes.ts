import { Router, type Request } from 'express';
import { contractSignRequestSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { getCommercialeContractStatus, signCommercialeContract } from '../services/commerciale-contract-service';
import type { ContractUser } from '../services/contract-profile-service';

type ResolveUser = (req: Request) => ContractUser | null | Promise<ContractUser | null>;

export function createCommercialeContractRouter(db: SupabaseLike, resolveUser: ResolveUser): Router {
  const router = Router();
  router.get('/status', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    const data = await getCommercialeContractStatus(db, user);
    return res.json({ success: true, data });
  });
  router.post('/sign', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    const parsed = contractSignRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'VALIDATION_FAILED', issues: parsed.error.issues });
    const data = await signCommercialeContract(db, {
      user,
      signatureImageData: parsed.data.signatureImageData,
      usedStoredSignature: parsed.data.useStoredSignature,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    return res.json({ success: true, data });
  });
  return router;
}
