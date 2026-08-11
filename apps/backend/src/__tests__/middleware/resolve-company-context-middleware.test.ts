import { describe, expect, it, vi } from 'vitest';
import { resolveCompanyContext } from '../../middleware/resolve-company-context-middleware';

describe('resolveCompanyContext', () => {
  it('sets req.companyId from X-Company-Id', () => {
    const req = { headers: { 'x-company-id': 'company-1' } } as any;
    const next = vi.fn();

    resolveCompanyContext(req, {} as any, next);

    expect(req.companyId).toBe('company-1');
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets req.companyId to null when header is missing', () => {
    const req = { headers: {} } as any;
    const next = vi.fn();

    resolveCompanyContext(req, {} as any, next);

    expect(req.companyId).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });
});
