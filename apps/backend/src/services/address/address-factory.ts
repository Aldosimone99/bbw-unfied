import type { IAddressService } from './address-interface';
import { NominatimAddressService } from './nominatim-address-service';
import { GoogleAddressService } from './google-address-service';
import { ItalianAddressService } from './italian-address-service';

export function createAddressService(): IAddressService {
  const provider = process.env.ADDRESS_PROVIDER ?? 'nominatim';
  if (provider === 'google') return new GoogleAddressService();
  if (provider === 'italian') return new ItalianAddressService();
  return new NominatimAddressService();
}
