import { describe, it, expect, vi } from 'vitest';

var mockAutocomplete = vi.hoisted(() => vi.fn());

vi.mock('../../services/address/address-factory', () => ({
  createAddressService: () => ({ autocomplete: mockAutocomplete, verify: vi.fn() }),
}));

import { createAddressRouter } from '../../routes/address-routes';

function makeReqRes(query: Record<string, string>) {
  const req = { query } as never;
  const res: Record<string, ReturnType<typeof vi.fn>> = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  return { req, res };
}

describe('GET /address/autocomplete', () => {
  it('returns suggestions from address service', async () => {
    mockAutocomplete.mockResolvedValueOnce([
      { label: 'Via Roma 1, Milano', via: 'Via Roma 1', citta: 'Milano', provincia: 'MI', cap: '20100', nazione: 'IT' },
    ]);

    const router = createAddressRouter();
    const handler = router.stack[0].route!.stack[0].handle;
    const { req, res } = makeReqRes({ q: 'Via Roma', country: 'IT' });

    await handler(req as never, res as never, vi.fn());

    expect(res.json).toHaveBeenCalledWith({
      suggestions: [expect.objectContaining({ citta: 'Milano' })],
    });
  });

  it('returns 400 when q param is missing', async () => {
    const router = createAddressRouter();
    const handler = router.stack[0].route!.stack[0].handle;
    const { req, res } = makeReqRes({});

    await handler(req as never, res as never, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
