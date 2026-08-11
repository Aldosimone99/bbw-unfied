import type { AddressSuggestion } from '@bbw/interfaces';
import type { AddressInput, IAddressService } from './address-interface';

export class GoogleAddressService implements IAddressService {
  private readonly apiKey: string;

  constructor(apiKey = process.env.GOOGLE_PLACES_API_KEY ?? '') {
    this.apiKey = apiKey;
  }

  async autocomplete(query: string, country = 'IT'): Promise<AddressSuggestion[]> {
    const params = new URLSearchParams({
      input: query,
      key: this.apiKey,
      components: `country:${country.toLowerCase()}`,
      language: 'it',
      types: 'address',
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
    if (!res.ok) return [];
    const data = await res.json() as { predictions?: Array<{ description: string; place_id: string }> };
    return (data.predictions ?? []).map((p) => ({
      label: p.description,
      via: '',
      citta: '',
      provincia: '',
      cap: '',
      nazione: country.toUpperCase(),
    }));
  }

  async verify(address: AddressInput): Promise<boolean> {
    const q = `${address.via}, ${address.citta}, ${address.cap}, ${address.nazione}`;
    const params = new URLSearchParams({ address: q, key: this.apiKey });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    if (!res.ok) return false;
    const data = await res.json() as { results?: unknown[] };
    return (data.results?.length ?? 0) > 0;
  }
}
