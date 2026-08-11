import { describe, it, expect, vi } from 'vitest';

const MockRegisterValidateService = vi.hoisted(() => {
  return class {
    validatePersonal = vi.fn().mockResolvedValue(null);
    validateAddress = vi.fn().mockResolvedValue(null);
    validateProfessional = vi.fn().mockResolvedValue(null);
    validateBusiness = vi.fn().mockResolvedValue(null);
    validatePassword = vi.fn().mockResolvedValue(null);
  };
});

vi.mock('../../../services/register-validate-service', () => ({
  RegisterValidateService: MockRegisterValidateService,
}));

import { createRegisterValidateRouter } from '../../../routes/auth/register-validate-routes';

function mockDb() { return {} as never; }

describe('POST /auth/register/validate/personal', () => {
  it('returns 200 when service returns null', async () => {
    const router = createRegisterValidateRouter(mockDb());
    const handler = router.stack[0].route!.stack[0].handle;
    const res: Record<string, ReturnType<typeof vi.fn>> = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ body: { tipo_utente: 'cliente', nome: 'Mario', cognome: 'Rossi', email: 'a@b.com', codice_fiscale: 'RSSMRA80A01H501U', data_nascita: '1980-01-01', sesso: 'M', telefono: '+39333' } } as never, res as never, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ valid: true });
  });
});
