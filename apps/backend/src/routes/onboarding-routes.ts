import { Router, type Request } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { deriveRegistrationOnboardingStatus } from '../services/onboarding-status-service';

interface RouteUser {
  id: string;
  tipo_utente: string;
}

type ResolveUser = (req: Request) => RouteUser | null | Promise<RouteUser | null>;

export function createOnboardingRouter(db: SupabaseLike, resolveUser: ResolveUser): Router {
  const router = Router();
  router.get('/status', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    const [{ data: signature }, { data: docs }, { data: business }, { data: studio }] = await Promise.all([
      db.from('contract_signatures').select('id').eq('user_id', user.id).maybeSingle(),
      db.from('verification_documents').select('type,status').eq('status', 'pending'),
      db.from('user_business_profiles').select('iban,ragione_sociale').eq('user_id', user.id).maybeSingle(),
      db.from('professional_studios').select('citta').eq('user_id', user.id).maybeSingle(),
    ]);
    const documentRows = Array.isArray(docs) ? docs as Array<{ type: string }> : [];
    const data = deriveRegistrationOnboardingStatus({
      role: user.tipo_utente as never,
      contractSigned: Boolean(signature),
      documents: {
        identity: documentRows.some((row) => row.type === 'identity'),
        insurance: documentRows.some((row) => row.type === 'insurance'),
        albo: documentRows.some((row) => row.type === 'albo'),
        asl: documentRows.some((row) => row.type === 'asl'),
      },
      studioComplete: Boolean((studio as { citta?: string } | null)?.citta),
      businessComplete: Boolean((business as { ragione_sociale?: string } | null)?.ragione_sociale),
      ibanComplete: Boolean((business as { iban?: string } | null)?.iban),
    });
    return res.json({ success: true, data });
  });
  return router;
}
