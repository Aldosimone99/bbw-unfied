import type { AddressSuggestion } from '@bbw/interfaces';
import type { AddressInput, IAddressService } from './address-interface';

const BASE_URL = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'Accept-Language': 'it', 'User-Agent': 'BBW-App/1.0' };

export class NominatimAddressService implements IAddressService {
  async autocomplete(query: string, country = 'IT'): Promise<AddressSuggestion[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: country.toLowerCase(),
    });
    const res = await fetch(`${BASE_URL}/search?${params}`, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json() as Array<{
      display_name: string;
      address?: { road?: string; city?: string; town?: string; village?: string; state?: string; postcode?: string; country_code?: string };
    }>;
    return data.map((item) => ({
      label: item.display_name,
      via: item.address?.road ?? '',
      citta: item.address?.city ?? item.address?.town ?? item.address?.village ?? '',
      provincia: item.address?.state ?? '',
      cap: item.address?.postcode ?? '',
      nazione: (item.address?.country_code ?? country).toUpperCase(),
    }));
  }

  async verify(address: AddressInput): Promise<boolean> {
    const q = `${address.via}, ${address.citta}, ${address.cap}, ${address.nazione}`;
    const params = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: address.nazione.toLowerCase() });
    const res = await fetch(`${BASE_URL}/search?${params}`, { headers: HEADERS });
    if (!res.ok) return false;
    const data = await res.json() as unknown[];
    return data.length > 0;
  }
}
