import type { Request, Response } from 'express';
import { createAddressService } from '../services/address/address-factory';

const addressService = createAddressService();

export async function autocompleteHandler(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '').trim();
  const country = String(req.query.country ?? 'IT').trim().toUpperCase();

  if (!q) {
    res.status(400).json({ error: 'MISSING_QUERY' });
    return;
  }

  const suggestions = await addressService.autocomplete(q, country);
  res.json({ suggestions });
}
