import type { AddressSuggestion } from '@bbw/interfaces';

export type { AddressSuggestion };

export interface AddressInput {
  via: string;
  citta: string;
  provincia: string;
  cap: string;
  nazione: string;
}

export interface IAddressService {
  autocomplete(query: string, country?: string): Promise<AddressSuggestion[]>;
  verify(address: AddressInput): Promise<boolean>;
}
