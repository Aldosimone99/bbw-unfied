import { createPPLInviteSchema } from '@bbw/interfaces';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import { defaultEmailService } from '../services/email-service';
import {
  acceptPPLInvite,
  createPPLInvite,
  listPPLInvites,
  lookupPPLInvite,
  PPLError,
  revokePPLInvite,
} from '../services/ppl-service';

const PROFESSIONAL_ROLES = ['medico', 'estetista'];
const COMPANY_PPL_ROLES  = ['owner', 'admin', 'staff', 'profissional'];

type Options = {
  resolveUserMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
};

function userId(req: Request): string {
  return String(req.user?.id ?? '');
}

function handlePPLError(res: Response, error: unknown) {
  if (error instanceof PPLError) return res.status(error.statusCode).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'PPL_FAILED' });
}

// Allows access either as a solo professional (medico/estetista, no company required)
// or as a company member with a PPL-capable role when X-Company-Id is present.
function requirePPLAccess(db: SupabaseLike) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, code: 'UNAUTHENTICATED' });

    const companyId = req.companyId ?? null;

    if (!companyId) {
      const role = (req.user as any).tipo_utente as string | undefined;
      if (!role || !PROFESSIONAL_ROLES.includes(role)) {
        return res.status(403).json({ success: false, code: 'PROFESSIONAL_REQUIRED' });
      }
      return next();
    }

    const { data, error } = await db
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return res.status(403).json({ success: false, code: 'COMPANY_MEMBER_REQUIRED' });
    const memberRole = String((data as { role: string }).role);
    if (!COMPANY_PPL_ROLES.includes(memberRole)) {
      return res.status(403).json({ success: false, code: 'COMPANY_ROLE_INSUFFICIENT' });
    }
    req.companyRole = memberRole;
    return next();
  };
}

export function createPPLRouter(db: SupabaseLike, options: Options = {}): Router {
  const router = Router();
  const requireUser = options.resolveUserMiddleware ?? resolveUser(db);

  router.get('/lookup/:token', async (req, res) => {
    try {
      const data = await lookupPPLInvite(db, String(req.params.token ?? ''));
      return res.json({ success: true, data });
    } catch (error) {
      return handlePPLError(res, error);
    }
  });

  router.post('/accept', requireUser, async (req, res) => {
    try {
      const token = String(req.body?.token ?? '').trim();
      const actorId = userId(req);
      if (!token || !actorId) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await acceptPPLInvite(db, token, actorId);
      return res.json({ success: true, data });
    } catch (error) {
      return handlePPLError(res, error);
    }
  });

  router.post('/', requireUser, requirePPLAccess(db), async (req, res) => {
    try {
      const parsed = createPPLInviteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await createPPLInvite(db, {
        professionalId: userId(req),
        companyId: parsed.data.companyId ?? null,
        email: parsed.data.email,
        nome: parsed.data.nome,
        cognome: parsed.data.cognome,
        expiresInDays: parsed.data.expiresInDays,
      }, defaultEmailService);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handlePPLError(res, error);
    }
  });

  router.get('/', requireUser, requirePPLAccess(db), async (req, res) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const companyId = req.companyId ?? null;
      const data = await listPPLInvites(db, userId(req), companyId, { page, limit });
      return res.json({ success: true, data });
    } catch (error) {
      return handlePPLError(res, error);
    }
  });

  router.delete('/:id', requireUser, requirePPLAccess(db), async (req, res) => {
    try {
      await revokePPLInvite(db, String(req.params.id), userId(req));
      return res.json({ success: true });
    } catch (error) {
      return handlePPLError(res, error);
    }
  });

  return router;
}
