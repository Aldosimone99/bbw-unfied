import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SupabaseLike } from '../db/supabase';
import { resolveUser } from '../middleware/resolve-user-middleware';
import { ZodError } from 'zod';
import {
  sendMessageRequestSchema,
  startThreadRequestSchema,
} from '@bbw/interfaces';
import {
  getOrCreateChatThread,
  sendChatMessage,
  listChatThreads,
  getChatContacts,
} from '../services/chat-service';
import {
  getThreadMessages,
  getUnreadCount,
  listNotificationThreads,
  markThreadAsRead,
  MessagingError,
} from '../services/messaging-service';

type MessagesRouterOptions = {
  resolveUserMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
};

function handleMessagingError(res: Response, error: unknown) {
  if (error instanceof MessagingError) return res.status(error.status).json({ success: false, code: error.code });
  if (error instanceof ZodError) return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', errors: error.issues });
  if (error instanceof SyntaxError) return res.status(400).json({ success: false, code: 'INVALID_JSON' });
  return res.status(500).json({ success: false, code: 'MESSAGES_FAILED' });
}

function userId(req: Request): string {
  if (!req.user) throw new MessagingError('UNAUTHENTICATED', 401);
  return req.user.id;
}

function userRole(req: Request): string | undefined {
  return (req.user as Record<string, unknown> | undefined)?.tipo_utente as string | undefined;
}

export function createMessagesRouter(db: SupabaseLike, options: MessagesRouterOptions = {}): Router {
  const router = Router();
  const requireUser = options.resolveUserMiddleware ?? resolveUser(db);

  router.get('/contacts', requireUser, async (req, res) => {
    try {
      const companyId = (req.headers['x-company-id'] as string | undefined) ?? undefined;
      const data = await getChatContacts(db, userId(req), userRole(req), companyId || undefined);
      return res.json({ success: true, data });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.post('/chat', requireUser, async (req, res) => {
    try {
      const { recipientId } = startThreadRequestSchema.parse(req.body);
      const threadId = await getOrCreateChatThread(db, userId(req), recipientId);
      return res.status(201).json({ success: true, data: { threadId } });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.get('/chat', requireUser, async (req, res) => {
    try {
      const data = await listChatThreads(db, userId(req), {
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 20),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.post('/chat/:threadId/messages', requireUser, async (req, res) => {
    try {
      const { content } = sendMessageRequestSchema.parse(req.body);
      const data = await sendChatMessage(db, String(req.params.threadId), userId(req), content);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.get('/chat/:threadId/messages', requireUser, async (req, res) => {
    try {
      const data = await getThreadMessages(db, String(req.params.threadId), userId(req), {
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 50),
      }, 'chat');
      return res.json({ success: true, data });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.post('/chat/:threadId/read', requireUser, async (req, res) => {
    try {
      await markThreadAsRead(db, String(req.params.threadId), userId(req), 'chat');
      return res.json({ success: true });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  router.get('/notifications', requireUser, async (req, res) => {
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

  router.get('/unread-count', requireUser, async (req, res) => {
    try {
      const count = await getUnreadCount(db, userId(req));
      return res.json({ success: true, data: { count } });
    } catch (error) {
      return handleMessagingError(res, error);
    }
  });

  return router;
}

