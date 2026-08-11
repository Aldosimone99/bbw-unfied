import {
  bookingSettingsPayloadSchema,
  createBlockedSlotSchema,
  createRoomSchema,
  updateRoomSchema,
  upsertAvailabilityWindowSchema,
} from '@bbw/interfaces';
import { Router } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { requireCompanyRole } from '../middleware/require-company-role-middleware';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  AvailabilityError,
  createBlockedSlot,
  createRoom,
  deleteAvailabilityWindow,
  deleteBlockedSlot,
  getBookingSettings,
  getWeeklySchedule,
  listBlockedSlots,
  listRooms,
  updateRoom,
  upsertAvailabilityWindow,
  upsertBookingSettings,
} from '../services/availability-service';

function userId(req: any): string {
  return String(req.user?.id ?? '');
}

function handleAvailabilityError(res: any, error: unknown) {
  if (error instanceof AvailabilityError) return res.status(error.statusCode).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'AVAILABILITY_FAILED' });
}

export function createAvailabilityRouter(db: SupabaseLike): Router {
  const router = Router();
  const requireUser = resolveUser(db);
  const requireClinicAdmin = requireCompanyRole(db, ['owner', 'admin', 'staff']);

  router.get('/schedule', requireUser, async (req, res) => {
    try {
      const professionalId = String(req.query.professionalId ?? userId(req));
      const data = await getWeeklySchedule(db, professionalId, req.companyId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.put('/schedule', requireUser, async (req, res) => {
    try {
      const parsed = upsertAvailabilityWindowSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const professionalId = String(req.body?.professionalId ?? userId(req));
      const data = await upsertAvailabilityWindow(db, professionalId, req.companyId, parsed.data);
      return res.json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.delete('/schedule/:windowId', requireUser, async (req, res) => {
    try {
      await deleteAvailabilityWindow(db, String(req.params.windowId), userId(req));
      return res.json({ success: true });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.get('/blocked', requireUser, async (req, res) => {
    try {
      const professionalId = String(req.query.professionalId ?? userId(req));
      const data = await listBlockedSlots(db, professionalId, req.companyId, {
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
      });
      return res.json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.post('/blocked', requireUser, async (req, res) => {
    try {
      const parsed = createBlockedSlotSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await createBlockedSlot(db, userId(req), req.companyId, parsed.data);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.delete('/blocked/:slotId', requireUser, async (req, res) => {
    try {
      await deleteBlockedSlot(db, String(req.params.slotId), userId(req));
      return res.json({ success: true });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.get('/settings', requireUser, async (req, res) => {
    try {
      const data = await getBookingSettings(db, userId(req));
      return res.json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.put('/settings', requireUser, async (req, res) => {
    try {
      const parsed = bookingSettingsPayloadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await upsertBookingSettings(db, userId(req), parsed.data);
      return res.json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.get('/rooms', requireUser, async (req, res) => {
    try {
      const data = await listRooms(db, req.companyId ?? '');
      return res.json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.post('/rooms', requireUser, requireClinicAdmin, async (req, res) => {
    try {
      const parsed = createRoomSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await createRoom(db, req.companyId ?? '', parsed.data);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  router.put('/rooms/:roomId', requireUser, requireClinicAdmin, async (req, res) => {
    try {
      const parsed = updateRoomSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, code: 'VALIDATION_FAILED' });
      const data = await updateRoom(db, String(req.params.roomId), req.companyId ?? '', parsed.data);
      return res.json({ success: true, data });
    } catch (error) {
      return handleAvailabilityError(res, error);
    }
  });

  return router;
}
