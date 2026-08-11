import { Router } from 'express';
import { autocompleteHandler } from '../controllers/address-controller';

export function createAddressRouter(): Router {
  const router = Router();
  router.get('/autocomplete', autocompleteHandler);
  return router;
}
