import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SENSITIVE_TOKEN_SECRET = process.env.SENSITIVE_TOKEN_SECRET ?? 'dev-secret-change-in-prod';

export function requireSensitiveToken(purpose: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.headers['x-verification-token'] as string | undefined;
    if (!token) {
      res.status(403).json({ error: 'SENSITIVE_TOKEN_REQUIRED' });
      return;
    }

    try {
      const payload = jwt.verify(token, SENSITIVE_TOKEN_SECRET) as {
        sub: string;
        purpose: string;
      };

      if (payload.purpose !== purpose) {
        res.status(403).json({ error: 'TOKEN_PURPOSE_MISMATCH' });
        return;
      }

      if (payload.sub !== req.user?.id) {
        res.status(403).json({ error: 'TOKEN_USER_MISMATCH' });
        return;
      }

      next();
    } catch {
      res.status(403).json({ error: 'INVALID_SENSITIVE_TOKEN' });
    }
  };
}
