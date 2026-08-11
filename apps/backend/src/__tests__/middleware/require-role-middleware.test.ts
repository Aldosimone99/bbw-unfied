import { describe, expect, it, vi } from 'vitest';
import { requireRole } from '../../middleware/require-role-middleware';

describe('requireRole', () => {
  it('allows admin regardless of required role', () => {
    const req = { user: { id: 'admin-id', email: 'a@example.com', tipo_utente: 'admin' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireRole('medico')(req as never, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks cliente from medico routes', () => {
    const req = { user: { id: 'cliente-id', email: 'c@example.com', tipo_utente: 'cliente' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireRole('medico')(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
