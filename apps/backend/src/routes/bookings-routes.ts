import { createAdminBookingSchema, createBookingRequestSchema } from '@bbw/interfaces';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import { requireCompanyRole } from '../middleware/require-company-role-middleware';
import {
  BookingError,
  cancelBooking,
  completeBooking,
  confirmBooking,
  createAdminBooking,
  createBookingRequest,
  getBooking,
  listBookings,
  markNoShow,
} from '../services/booking-service';

type Options = {
  resolveUserMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
};

function actorId(req: Request): string {
  return String((req as any).user?.id ?? req.body?.userId ?? '');
}

function actorRole(req: Request): string {
  return String((req as any).companyRole ?? (req as any).user?.tipo_utente ?? req.query.actorRole ?? 'paciente');
}

function handleBookingError(res: Response, error: unknown) {
  if (error instanceof BookingError) return res.status(error.statusCode).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'BOOKING_FAILED' });
}

export function createBookingsRouter(db: SupabaseLike, options: Options = {}): Router {
  const router = Router();
  const requireUser = options.resolveUserMiddleware ?? resolveUser(db);
  const requireAdminBookingRole = requireCompanyRole(db, ['owner', 'admin', 'staff', 'profissional']);

  router.post('/', requireUser, async (req, res) => {
    try {
      const parsed = createBookingRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await createBookingRequest(db, { ...parsed.data, patientId: actorId(req) });
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleBookingError(res, error);
    }
  });

  router.post('/admin', requireUser, requireAdminBookingRole, async (req, res) => {
    try {
      const parsed = createAdminBookingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await createAdminBooking(db, actorId(req), actorRole(req), parsed.data);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleBookingError(res, error);
    }
  });

  router.get('/', requireUser, async (req, res) => {
    try {
      const data = await listBookings(db, actorId(req), actorRole(req), {
        status: req.query.status ? String(req.query.status) : undefined,
        date: req.query.date ? String(req.query.date) : undefined,
        companyId: req.companyId ?? undefined,
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 20),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return handleBookingError(res, error);
    }
  });

  router.get('/:id', requireUser, async (req, res) => {
    try {
      const data = await getBooking(db, String(req.params.id), actorId(req));
      return res.json({ success: true, data });
    } catch (error) {
      return handleBookingError(res, error);
    }
  });

  router.post('/:id/confirm', requireUser, requireAdminBookingRole, async (req, res) => {
    try {
      const data = await confirmBooking(db, String(req.params.id), actorId(req));
      return res.json({ success: true, data });
    } catch (error) {
      return handleBookingError(res, error);
    }
  });

  router.post('/:id/cancel', requireUser, async (req, res) => {
    try {
      const data = await cancelBooking(db, String(req.params.id), actorId(req));
      return res.json({ success: true, data });
    } catch (error) {
      return handleBookingError(res, error);
    }
  });

  router.post('/:id/complete', requireUser, requireAdminBookingRole, async (req, res) => {
    try {
      const data = await completeBooking(db, String(req.params.id), actorId(req));
      return res.json({ success: true, data });
    } catch (error) {
      return handleBookingError(res, error);
    }
  });

  router.post('/:id/no-show', requireUser, requireAdminBookingRole, async (req, res) => {
    try {
      const data = await markNoShow(db, String(req.params.id), actorId(req));
      return res.json({ success: true, data });
    } catch (error) {
      return handleBookingError(res, error);
    }
  });

  return router;
}
