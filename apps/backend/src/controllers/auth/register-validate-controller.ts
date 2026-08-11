import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import type { SupabaseLike } from '../../db/supabase';
import { RegisterValidateService } from '../../services/register-validate-service';
import { validatePersonalSchema, validateAddressSchema, validateProfessionalSchema, validateBusinessSchema, validatePasswordSchema } from '@bbw/interfaces';

function zodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    if (issue.path.length === 0) continue;
    const field = issue.path.join('.');
    if (errors[field]) continue;
    errors[field] = 'invalid_format';
    if (issue.code === 'invalid_type' || issue.code === 'too_small') {
      errors[field] = 'required';
    }
  }
  return errors;
}

export function createRegisterValidateController(db: SupabaseLike) {
  const svc = new RegisterValidateService(db);

  return {
    personal: async (req: Request, res: Response) => {
      const parsed = validatePersonalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ errors: zodErrors(parsed.error) });
      }
      const result = await svc.validatePersonal(parsed.data);
      if (result) return res.status(422).json(result);
      return res.json({ valid: true });
    },
    address: async (req: Request, res: Response) => {
      const parsed = validateAddressSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ errors: zodErrors(parsed.error) });
      }
      const result = await svc.validateAddress(parsed.data);
      if (result) return res.status(422).json(result);
      return res.json({ valid: true });
    },
    professional: async (req: Request, res: Response) => {
      const parsed = validateProfessionalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ errors: zodErrors(parsed.error) });
      }
      const result = await svc.validateProfessional(parsed.data);
      if (result) return res.status(422).json(result);
      return res.json({ valid: true });
    },
    business: async (req: Request, res: Response) => {
      const parsed = validateBusinessSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ errors: zodErrors(parsed.error) });
      }
      const result = await svc.validateBusiness(parsed.data);
      if (result) return res.status(422).json(result);
      return res.json({ valid: true });
    },
    password: async (req: Request, res: Response) => {
      const parsed = validatePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ errors: zodErrors(parsed.error) });
      }
      const result = await svc.validatePassword(parsed.data);
      if (result) return res.status(422).json(result);
      return res.json({ valid: true });
    },
  };
}
