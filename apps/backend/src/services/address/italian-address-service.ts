import ItalianAddressClient from '@pallari/italian-address-client';
import type { AddressSuggestion } from '@bbw/interfaces';
import type { AddressInput, IAddressService } from './address-interface';

export class ItalianAddressService implements IAddressService {
  private readonly client: ItalianAddressClient;

  constructor() {
    this.client = new ItalianAddressClient();
  }

  async autocomplete(query: string, _country = 'IT'): Promise<AddressSuggestion[]> {
    const municipalities = await this.client.searchMunicipalities(query, { limit: 5 });
    return municipalities.map((m: { name: string; province: string; istat_code: string; cadastral_code: string }) => ({
      label: `${m.name} (${m.province})`,
      via: '',
      citta: m.name,
      provincia: m.province,
      cap: '',
      nazione: 'IT',
    }));
  }

  async verify(address: AddressInput): Promise<boolean> {
    const results = await this.client.searchMunicipalities(address.citta, { limit: 1 });
    return results.length > 0;
  }
}
