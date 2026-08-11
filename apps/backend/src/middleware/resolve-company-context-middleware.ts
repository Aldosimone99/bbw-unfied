import type { NextFunction, Request, Response } from 'express';

export function resolveCompanyContext(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers['x-company-id'];
  req.companyId = Array.isArray(header) ? header[0] ?? null : header ?? null;
  next();
}
