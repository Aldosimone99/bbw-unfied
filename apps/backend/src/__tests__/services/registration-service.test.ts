import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerUser } from '../../services/registration-service';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
});

interface InsertRecord {
  table: string;
  query: { data?: unknown; error?: unknown };
}

function makeRegistrationDb(overrides: {
  usersByEmail?: { id: string } | null;
  usersByCf?: { id: string } | null;
  otp?: {
    reference: string;
    email: string;
    purpose: string;
    verified_at: string;
    expires_at: string;
  } | null;
  createUser?: ReturnType<typeof vi.fn>;
  inserts?: InsertRecord[];
  businessProfileByField?: { user_id: string } | null;
  credentialByField?: { user_id: string } | null;
  invite?: Record<string, unknown> | null;
  referralCode?: Record<string, unknown> | null;
}) {
  const insertRecords = overrides.inserts ?? [];
  const otpData = overrides.otp === undefined
    ? {
        reference: 'otp-ref',
        email: 'mario@example.com',
        purpose: 'registration',
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }
    : overrides.otp;
  const prefilledUsersByEmail = overrides.usersByEmail === undefined ? null : overrides.usersByEmail;
  const prefilledUsersByCf = overrides.usersByCf === undefined ? null : overrides.usersByCf;
  const prefilledBusiness = overrides.businessProfileByField === undefined ? null : overrides.businessProfileByField;
  const prefilledCredential = overrides.credentialByField === undefined ? null : overrides.credentialByField;
  const prefilledInvite = overrides.invite === undefined ? null : overrides.invite;
  const prefilledReferralCode = overrides.referralCode === undefined ? null : overrides.referralCode;

  return {
    auth: {
      admin: {
        createUser: overrides.createUser ?? vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user-id' } } }),
        deleteUser: vi.fn().mockResolvedValue({}),
      },
    },
    from: vi.fn((table: string) => {
      const record = insertRecords.find((r) => r.table === table);
      const nextQuery = () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(record?.query ?? { data: null }),
        insert: vi.fn((payload: unknown) => {
          insertRecords.push({ table, query: { data: payload } });
          return { error: undefined };
        }),
      });

      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string) => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: col === 'email'
                ? prefilledUsersByEmail
                : col === 'codice_fiscale'
                  ? prefilledUsersByCf
                  : null,
            }),
          })),
          insert: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { error: undefined };
          }),
        };
      }

      if (table === 'otps') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: otpData }),
        };
      }

      if (table === 'user_business_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: prefilledBusiness }),
          insert: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { error: undefined };
          }),
        };
      }

      if (table === 'professional_credentials') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: prefilledCredential }),
          insert: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { error: undefined };
          }),
        };
      }

      if (table === 'invites') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: prefilledInvite }),
          update: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
          insert: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { error: undefined };
          }),
        };
      }

      if (table === 'referral_codes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: prefilledReferralCode }),
          insert: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { error: undefined };
          }),
        };
      }

      if (table === 'referrals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          insert: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { error: undefined };
          }),
        };
      }

      if (table === 'company_member_invites' || table === 'company_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          insert: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { error: undefined };
          }),
          upsert: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { error: null };
          }),
          update: vi.fn((payload: unknown) => {
            insertRecords.push({ table, query: { data: payload } });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }

      return nextQuery();
    }),
  };
}

describe('registerUser', () => {
  it('checks duplicate email before creating auth user', async () => {
    const createUser = vi.fn();
    const db = makeRegistrationDb({ usersByEmail: { id: 'existing' }, createUser });

    await expect(registerUser(db, {
      tipo_utente: 'cliente',
      email: 'mario@example.com',
      password: 'Password123!',
      otp_reference: 'otp-ref',
      accept_terms: true,
      accept_privacy: true,
      codice_fiscale: 'RSSMRA80A01H501U',
      consenso_marketing: true,
      consenso_profilazione: true,
    })).rejects.toMatchObject({ details: { code: 'EMAIL_ALREADY_EXISTS', status: 409 } });

    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects registration when otp reference is not verified for the email', async () => {
    const createUser = vi.fn();
    const db = makeRegistrationDb({
      usersByEmail: null,
      usersByCf: null,
      otp: null,
      createUser,
    });

    await expect(registerUser(db, {
      tipo_utente: 'cliente',
      email: 'mario@example.com',
      password: 'Password123!',
      otp_reference: 'missing-ref',
      accept_terms: true,
      accept_privacy: true,
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      consenso_marketing: true,
      consenso_profilazione: true,
    })).rejects.toMatchObject({ details: { code: 'REGISTRATION_OTP_REQUIRED', status: 422 } });

    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects duplicate codice fiscale', async () => {
    const createUser = vi.fn();
    const db = makeRegistrationDb({
      usersByEmail: null,
      usersByCf: { id: 'existing-cf' },
      otp: {
        reference: 'otp-ref',
        email: 'doctor@example.com',
        purpose: 'registration',
        verified_at: new Date(Date.now() - 60000).toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      createUser,
    });

    await expect(registerUser(db, {
      tipo_utente: 'cliente',
      email: 'doctor@example.com',
      password: 'Password123!',
      otp_reference: 'otp-ref',
      accept_terms: true,
      accept_privacy: true,
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      consenso_marketing: true,
      consenso_profilazione: true,
    })).rejects.toMatchObject({ details: { code: 'CODICE_FISCALE_ALREADY_EXISTS', status: 409 } });

    expect(createUser).not.toHaveBeenCalled();
  });

  it('inserts business, credential, studio, and consent rows for medico', async () => {
    const inserts: Array<{ table: string; payload?: unknown }> = [];
    const db = makeRegistrationDb({
      usersByEmail: null,
      usersByCf: null,
      otp: {
        reference: 'otp-ref',
        email: 'doctor@example.com',
        purpose: 'registration',
          verified_at: new Date(Date.now() - 60000).toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user-id' } } }),
      inserts: inserts as unknown as InsertRecord[],
    });

    await registerUser(db, {
      tipo_utente: 'medico',
      email: 'doctor@example.com',
      password: 'Password123!',
      otp_reference: 'otp-ref',
      accept_terms: true,
      accept_privacy: true,
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      consenso_marketing: true,
      consenso_profilazione: true,
      numero_albo: 'ALBO-123',
      studio_citta: 'Milano',
      studio_via: 'Via Studio 1',
    });

    const tables = inserts.map((entry) => entry.table);
    expect(tables).toEqual(expect.arrayContaining([
      'users',
      'user_consents',
      'user_business_profiles',
      'professional_credentials',
      'professional_studios',
    ]));
  });

  it('rejects duplicate partita_iva', async () => {
    const createUser = vi.fn();
    const db = makeRegistrationDb({
      usersByEmail: null,
      usersByCf: null,
      businessProfileByField: { user_id: 'existing-business' },
      otp: {
        reference: 'otp-ref',
        email: 'company@example.com',
        purpose: 'registration',
          verified_at: new Date(Date.now() - 60000).toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      createUser,
    });

    await expect(registerUser(db, {
      tipo_utente: 'clinica',
      email: 'company@example.com',
      password: 'Password123!',
      otp_reference: 'otp-ref',
      accept_terms: true,
      accept_privacy: true,
      nome: 'Clinica Demo',
      ragione_sociale: 'Clinica Demo SRL',
      partita_iva: '12345678901',
      consenso_marketing: true,
      consenso_profilazione: true,
    })).rejects.toMatchObject({ details: { code: 'PARTITA_IVA_ALREADY_EXISTS', status: 409 } });

    expect(createUser).not.toHaveBeenCalled();
  });

  it('deletes auth user when an app insert fails', async () => {
    const deleteUser = vi.fn().mockResolvedValue({});
    const inserts: Array<{ table: string; query: { data?: unknown; error?: unknown } }> = [];

    const db = {
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user-id' } } }),
          deleteUser,
        },
      },
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn()
              .mockResolvedValueOnce({ data: null })  // email check
              .mockResolvedValueOnce({ data: null }), // cf check
            insert: vi.fn((payload: unknown) => {
              inserts.push({ table, query: { data: payload } });
              return { error: undefined };
            }),
          };
        }
        if (table === 'otps') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                reference: 'otp-ref',
                email: 'mario@example.com',
                purpose: 'registration',
                verified_at: new Date(Date.now() - 60000).toISOString(),
                expires_at: new Date(Date.now() + 3600000).toISOString(),
              },
            }),
          };
        }
        if (table === 'user_business_profiles' || table === 'professional_credentials') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn().mockResolvedValue({ error: undefined }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          insert: vi.fn().mockResolvedValue({ error: new Error('insert failed') }),
        };
      }),
    };

    await expect(registerUser(db, {
      tipo_utente: 'cliente',
      email: 'mario@example.com',
      password: 'Password123!',
      otp_reference: 'otp-ref',
      accept_terms: true,
      accept_privacy: true,
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      consenso_marketing: true,
      consenso_profilazione: true,
    })).rejects.toMatchObject({ details: { code: 'REGISTRATION_FAILED' } });

    expect(deleteUser).toHaveBeenCalledWith('auth-user-id');
  });

  it('validates invite code before creating auth user', async () => {
    const createUser = vi.fn();
    const db = makeRegistrationDb({
      usersByEmail: null,
      usersByCf: null,
      otp: {
        reference: 'otp-ref',
        email: 'mario@example.com',
        purpose: 'registration',
        verified_at: new Date(Date.now() - 60000).toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      invite: null,
      createUser,
    });

    await expect(registerUser(db, {
      tipo_utente: 'cliente',
      email: 'mario@example.com',
      password: 'Password123!',
      otp_reference: 'otp-ref',
      accept_terms: true,
      accept_privacy: true,
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      consenso_marketing: true,
      consenso_profilazione: true,
      invite_code: 'INV-MISSING',
    })).rejects.toMatchObject({ details: { code: 'INVITE_NOT_FOUND' } });

    expect(createUser).not.toHaveBeenCalled();
  });

  it('redeems invite and referral after user rows are created', async () => {
    const inserts: Array<{ table: string; query: { data?: unknown } }> = [];
    const db = makeRegistrationDb({
      usersByEmail: null,
      usersByCf: null,
      otp: {
        reference: 'otp-ref',
        email: 'mario@example.com',
        purpose: 'registration',
        verified_at: new Date(Date.now() - 60000).toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      invite: {
        code: 'INV-ABC123',
        email: 'mario@example.com',
        type: 'cliente',
        status: 'pending',
        expires_at: '2099-01-01T00:00:00.000Z',
      },
      referralCode: { code: 'REF-ABC123', user_id: 'referrer-1', is_active: true },
      createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user-id' } } }),
      inserts: inserts as unknown as InsertRecord[],
    });

    await registerUser(db, {
      tipo_utente: 'cliente',
      email: 'mario@example.com',
      password: 'Password123!',
      otp_reference: 'otp-ref',
      accept_terms: true,
      accept_privacy: true,
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      consenso_marketing: true,
      consenso_profilazione: true,
      invite_code: 'INV-ABC123',
      codice_riferimento: 'REF-ABC123',
    });

    const inviteUpdates = inserts.filter((entry) => entry.table === 'invites');
    expect(inviteUpdates.length).toBeGreaterThanOrEqual(1);

    const referralInserts = inserts.filter((entry) => entry.table === 'referrals');
    expect(referralInserts.length).toBeGreaterThanOrEqual(1);
  });
});
