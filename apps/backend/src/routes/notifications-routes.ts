import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import {
  getThreadMessages,
  getUnreadCount,
  listNotificationThreads,
  markThreadAsRead,
  MessagingError,
} from '../services/messaging-service';

type NotificationsRouterOptions = {
  resolveUserMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
};

function handleMessagingError(res: Response, error: unknown) {
  if (error instanceof MessagingError) return res.status(error.status).json({ success: false, code: error.code });
  return res.status(500).json({ success: false, code: 'NOTIFICATIONS_FAILED' });
}

function userId(req: Request): string {
  if (!req.user) throw new MessagingError('UNAUTHENTICATED', 401);
  return req.user.id;
}

export function createNotificationsRouter(db: SupabaseLike, options: NotificationsRouterOptions = {}): Router {
  const router = Router();
  const requireUser = options.resolveUserMiddleware ?? resolveUser(db);

  router.get('/unread-count', requireUser, async (req, res) => {
    try {
      const count = await getUnreadCount(db, userId(req));
      return res.json({ success: true, data: { count } });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.get('/', requireUser, async (req, res) => {
    try {
      const data = await listNotificationThreads(db, userId(req), {
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 20),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.get('/:threadId', requireUser, async (req, res) => {
    try {
      const data = await getThreadMessages(db, String(req.params.threadId), userId(req), {
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 50),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.post('/:threadId/read', requireUser, async (req, res) => {
    try {
      await markThreadAsRead(db, String(req.params.threadId), userId(req));
      return res.json({ success: true });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  return router;
}
