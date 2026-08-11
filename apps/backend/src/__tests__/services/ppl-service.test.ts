import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptPPLInvite,
  createPPLInvite,
  listPPLInvites,
  lookupPPLInvite,
  PPLError,
  revokePPLInvite,
  setPPLStatus,
} from '../../services/ppl-service';

const ids = {
  professional: '11111111-1111-4111-8111-111111111111',
  patient: '22222222-2222-4222-8222-222222222222',
  company: '33333333-3333-4333-8333-333333333333',
  invite: '44444444-4444-4444-8444-444444444444',
};

function createDbMock() {
  const state = {
    users: [{ id: ids.patient, email: 'cliente@example.com', nome: 'Ada', cognome: 'Rossi' }],
    ppl_invites: [] as any[],
    patient_professional_links: [] as any[],
    bookings: [] as any[],
    companies: [{ id: ids.company, name: 'Clinica Centro' }],
  };

  const db = {
    state,
    from: vi.fn((table: keyof typeof state) => queryBuilder(state, table)),
  };
  return db as any;
}

function queryBuilder(state: any, table: string) {
  const filters: Array<(row: any) => boolean> = [];
  let selectedCount = false;
  const builder: any = {
    select: vi.fn((_cols?: string, opts?: { count?: string }) => {
      selectedCount = opts?.count === 'exact';
      return builder;
    }),
    eq: vi.fn((field: string, value: unknown) => {
      filters.push((row) => row[field] === value);
      return builder;
    }),
    is: vi.fn((field: string, value: null) => {
      filters.push((row) => row[field] === value);
      return builder;
    }),
    in: vi.fn((field: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[field]));
      return builder;
    }),
    ilike: vi.fn((field: string, value: string) => {
      filters.push((row) => String(row[field]).toLowerCase() === value.toLowerCase());
      return builder;
    }),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      const data = state[table].filter((row: any) => filters.every((fn) => fn(row)))[0] ?? null;
      return { data, error: null };
    }),
    single: vi.fn(async () => {
      const data = state[table].filter((row: any) => filters.every((fn) => fn(row)))[0] ?? null;
      return { data, error: data ? null : { message: 'not found' } };
    }),
    insert: vi.fn((payload: any) => {
      const row = { id: payload.id ?? `${table}-${state[table].length + 1}`, ...payload };
      state[table].push(row);
      builder._last = row;
      return builder;
    }),
    upsert: vi.fn((payload: any, _opts?: any) => {
      const existing = state[table].find((row: any) =>
        row.patient_id === payload.patient_id &&
        row.professional_id === payload.professional_id &&
        row.company_id === payload.company_id,
      );
      if (existing) Object.assign(existing, payload);
      else state[table].push({ id: `${table}-${state[table].length + 1}`, ...payload });
      builder._last = existing ?? state[table][state[table].length - 1];
      return builder;
    }),
    update: vi.fn((payload: any) => {
      builder._update = payload;
      return builder;
    }),
    delete: vi.fn(() => builder),
    then: (resolve: any, reject: any) => {
      const data = state[table].filter((row: any) => filters.every((fn) => fn(row)));
      if (builder._update) {
        for (const row of data) {
          Object.assign(row, builder._update);
        }
        builder._update = undefined;
      }
      return Promise.resolve({ data, count: selectedCount ? data.length : undefined, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

describe('ppl-service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
  });

  it('creates pending PPL and sends email when patient account exists', async () => {
    const db = createDbMock();
    const emailService = { sendPPLInviteEmail: vi.fn().mockResolvedValue(undefined) };
    const messagingService = {
      getOrCreateNotificationThread: vi.fn().mockResolvedValue('thread-1'),
      insertSystemMessage: vi.fn().mockResolvedValue(undefined),
    };

    const result = await createPPLInvite(db, {
      professionalId: ids.professional,
      companyId: ids.company,
      email: 'cliente@example.com',
      nome: 'Ada',
      cognome: 'Rossi',
      expiresInDays: 7,
    }, emailService as any, {
      tokenFactory: () => 'accept-token',
      messagingService,
    });

    expect(result.pplCreated).toBe(true);
    expect(db.state.patient_professional_links[0]).toMatchObject({
      patient_id: ids.patient,
      professional_id: ids.professional,
      company_id: ids.company,
      status: 'pending',
    });
    expect(emailService.sendPPLInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'cliente@example.com',
    }));
    expect(messagingService.insertSystemMessage).toHaveBeenCalledWith(
      db,
      'thread-1',
      ids.professional,
      'ppl_invite_received',
      expect.objectContaining({ inviteId: expect.any(String) }),
    );
  });

  it('throws 409 for duplicate pending invite', async () => {
    const db = createDbMock();
    db.state.ppl_invites.push({
      id: ids.invite,
      professional_id: ids.professional,
      company_id: null,
      email: 'cliente@example.com',
      status: 'pending',
    });

    await expect(createPPLInvite(db, {
      professionalId: ids.professional,
      companyId: null,
      email: 'cliente@example.com',
    }, { sendPPLInviteEmail: vi.fn() } as any)).rejects.toMatchObject({
      code: 'PPL_INVITE_ALREADY_PENDING',
      statusCode: 409,
    });
  });

  it('accepts invite idempotently and approves PPL', async () => {
    const db = createDbMock();
    db.state.ppl_invites.push({
      id: ids.invite,
      professional_id: ids.professional,
      company_id: null,
      patient_id: ids.patient,
      email: 'cliente@example.com',
      accept_token: 'token',
      status: 'pending',
      expires_at: '2026-07-01T12:00:00.000Z',
    });

    const result = await acceptPPLInvite(db, 'token', ids.patient, {
      messagingService: {
        getOrCreateNotificationThread: vi.fn().mockResolvedValue('thread-1'),
        insertSystemMessage: vi.fn().mockResolvedValue(undefined),
      },
    });

    expect(result.ppl.status).toBe('approved');
    expect(db.state.ppl_invites[0].status).toBe('accepted');
  });

  it('rejects expired invite tokens', async () => {
    const db = createDbMock();
    db.state.ppl_invites.push({
      id: ids.invite,
      professional_id: ids.professional,
      company_id: null,
      patient_id: ids.patient,
      email: 'cliente@example.com',
      accept_token: 'expired',
      status: 'pending',
      expires_at: '2026-06-24T12:00:00.000Z',
    });

    await expect(acceptPPLInvite(db, 'expired', ids.patient)).rejects.toBeInstanceOf(PPLError);
  });

  it('looks up pending invite by token', async () => {
    const db = createDbMock();
    db.state.ppl_invites.push({
      id: ids.invite,
      professional_id: ids.professional,
      company_id: null,
      patient_id: null,
      email: 'cliente@example.com',
      nome: 'Ada',
      cognome: 'Rossi',
      accept_token: 'lookup-token',
      status: 'pending',
      expires_at: '2026-07-01T12:00:00.000Z',
    });

    const result = await lookupPPLInvite(db, 'lookup-token');
    expect(result.status).toBe('pending');
    expect(result.professionalName).toBeTruthy();
  });

  it('lists PPL invites with pagination', async () => {
    const db = createDbMock();
    db.state.ppl_invites.push(
      { id: '1', professional_id: ids.professional, email: 'a@a.com', status: 'pending', company_id: null },
      { id: '2', professional_id: ids.professional, email: 'b@b.com', status: 'accepted', company_id: null },
    );

    const result = await listPPLInvites(db, ids.professional, null, { page: 1, limit: 20 });
    expect(result.total).toBe(2);
  });
});
