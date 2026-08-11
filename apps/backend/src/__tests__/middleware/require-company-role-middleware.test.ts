import { describe, expect, it, vi } from 'vitest';
import { requireCompanyRole } from '../../middleware/require-company-role-middleware';

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

function makeDb(member: Record<string, unknown> | null) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'company_members') throw new Error(`unexpected table ${table}`);
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: member }),
      };
    }),
  };
}

describe('requireCompanyRole', () => {
  it('attaches companyRole when the user has an allowed active role', async () => {
    const req = {
      user: { id: 'user-1' },
      companyId: 'company-1',
    };
    const res = makeRes();
    const next = vi.fn();

    await requireCompanyRole(makeDb({ role: 'owner' }), ['owner', 'admin'])(req as never, res as never, next);

    expect(req).toMatchObject({ companyRole: 'owner' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when the user is not an active company member', async () => {
    const req = {
      user: { id: 'user-1' },
      companyId: 'company-1',
    };
    const res = makeRes();
    const next = vi.fn();

    await requireCompanyRole(makeDb(null), ['owner'])(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, code: 'COMPANY_MEMBER_REQUIRED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('uses req.companyId set by X-Company-Id header middleware', async () => {
    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'owner' }, error: null }),
      })),
    } as any;
    const req = {
      user: { id: 'user-1' },
      companyId: 'header-company',
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await requireCompanyRole(db, ['owner'])(req, res as never, next);

    const builder = db.from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith('company_id', 'header-company');
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when the member role is insufficient', async () => {
    const req = {
      user: { id: 'user-1' },
      companyId: 'company-1',
    };
    const res = makeRes();
    const next = vi.fn();

    await requireCompanyRole(makeDb({ role: 'paciente' }), ['owner', 'admin'])(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, code: 'COMPANY_ROLE_INSUFFICIENT' });
    expect(next).not.toHaveBeenCalled();
  });
});
