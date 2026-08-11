import type { NextFunction, Request, Response } from 'express';
import type { AppRole } from '@bbw/interfaces';

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (req.user.tipo_utente === 'admin') return next();
    if (!roles.includes(req.user.tipo_utente)) {
      return res.status(403).json({ error: 'FORBIDDEN', required: roles });
    }
    return next();
  };
}
