import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NominatimAddressService } from '../../../services/address/nominatim-address-service';

global.fetch = vi.fn();

describe('NominatimAddressService', () => {
  let service: NominatimAddressService;

  beforeEach(() => {
    service = new NominatimAddressService();
    vi.mocked(global.fetch).mockReset();
  });

  it('autocomplete returns mapped suggestions', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          display_name: 'Via Roma 1, Milano, Lombardia, 20100, Italia',
          address: {
            road: 'Via Roma',
            city: 'Milano',
            state: 'Lombardia',
            postcode: '20100',
            country_code: 'it',
          },
        },
      ]),
    } as Response);

    const results = await service.autocomplete('Via Roma', 'IT');
    expect(results).toHaveLength(1);
    expect(results[0].citta).toBe('Milano');
    expect(results[0].nazione).toBe('IT');
  });

  it('verify returns true when geocoding finds a match', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ place_id: '123' }]),
    } as Response);

    const result = await service.verify({ via: 'Via Roma 1', citta: 'Milano', provincia: 'MI', cap: '20100', nazione: 'IT' });
    expect(result).toBe(true);
  });

  it('verify returns false when geocoding finds no match', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ([]),
    } as Response);

    const result = await service.verify({ via: 'Indirizzo Inesistente', citta: 'XYZ', provincia: 'XX', cap: '00000', nazione: 'IT' });
    expect(result).toBe(false);
  });
});
