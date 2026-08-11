import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/address/address-factory', () => ({
  createAddressService: () => ({
    autocomplete: vi.fn(),
    verify: vi.fn().mockResolvedValue(true),
  }),
}));

import { RegisterValidateService } from '../../services/register-validate-service';

const mockDb = {
  from: vi.fn(),
};

function chain(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  };
}

function chainError(): ReturnType<typeof chain> {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'multiple rows' } }),
  };
}

describe('RegisterValidateService.validatePersonal', () => {
  let service: RegisterValidateService;

  beforeEach(() => {
    service = new RegisterValidateService(mockDb as never);
    vi.mocked(mockDb.from).mockReturnValue(chain(null));
  });

  it('returns null for a valid personal payload', async () => {
    const result = await service.validatePersonal({
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario@example.com',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      telefono: '+393331234567',
    });
    expect(result).toBeNull();
  });

  it('returns error when age is under 18', async () => {
    const underAge = new Date();
    underAge.setFullYear(underAge.getFullYear() - 17);
    const result = await service.validatePersonal({
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario@example.com',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: underAge.toISOString().slice(0, 10),
      sesso: 'M',
      telefono: '+393331234567',
    });
    expect(result?.errors.data_nascita).toBe('must_be_18_or_older');
  });

  it('returns error when email is already taken', async () => {
    vi.mocked(mockDb.from).mockReturnValue(chain({ id: 'existing-user' }));
    const result = await service.validatePersonal({
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'taken@example.com',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      telefono: '+393331234567',
    });
    expect(result?.errors.email).toBe('already_taken');
  });

  it('returns error when codice_fiscale is already taken', async () => {
    vi.mocked(mockDb.from).mockReturnValue(chain({ id: 'existing-user' }));
    const result = await service.validatePersonal({
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'unique@example.com',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      telefono: '+393331234567',
    });
    expect(result?.errors.codice_fiscale).toBe('already_taken');
  });

  it('returns error when telefono is already taken', async () => {
    vi.mocked(mockDb.from).mockReturnValue(chain({ id: 'existing-user' }));
    const result = await service.validatePersonal({
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'unique@example.com',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      telefono: '+393331234567',
    });
    expect(result?.errors.telefono).toBe('already_taken');
  });

  it('returns error when telefono has multiple DB rows (PGRST116)', async () => {
    vi.mocked(mockDb.from).mockReturnValue(chainError());
    const result = await service.validatePersonal({
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'unique@example.com',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      telefono: '+393331234567',
    });
    expect(result?.errors.telefono).toBe('already_taken');
  });

  it('skips CF check for clinica role', async () => {
    vi.mocked(mockDb.from).mockReturnValue(chain({ id: 'existing-user' }));
    const result = await service.validatePersonal({
      tipo_utente: 'clinica',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'unique@example.com',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      telefono: '+393331234567',
    });
    expect(result?.errors.codice_fiscale).toBeUndefined();
  });

  it('throws DatabaseError on unknown DB error', async () => {
    const badChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST000', message: 'unknown error' } }),
    };
    vi.mocked(mockDb.from).mockReturnValue(badChain);
    await expect(service.validatePersonal({
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario@example.com',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      telefono: '+393331234567',
    })).rejects.toThrow('DB query failed');
  });
});

describe('RegisterValidateService.validatePassword', () => {
  let service: RegisterValidateService;

  beforeEach(() => {
    service = new RegisterValidateService(mockDb as never);
  });

  it('returns null for a strong password', async () => {
    const result = await service.validatePassword({ password: 'Corr3ct-Horse-Battery-Staple' });
    expect(result).toBeNull();
  });

  it('returns too_weak for a short password', async () => {
    const result = await service.validatePassword({ password: '12345' });
    expect(result?.errors.password).toBe('too_weak');
  });
});

describe('RegisterValidateService.validateBusiness', () => {
  let service: RegisterValidateService;

  beforeEach(() => {
    service = new RegisterValidateService(mockDb as never);
    vi.mocked(mockDb.from).mockReturnValue(chain(null));
  });

  it('returns error for invalid partita_iva', async () => {
    const result = await service.validateBusiness({
      ragione_sociale: 'Acme Srl',
      partita_iva: '00000000000',
      pec: 'pec@example.com',
      codice_sdi: 'AAAAAAA',
    });
    expect(result?.errors.partita_iva).toBe('partita_iva_invalid');
  });
});
