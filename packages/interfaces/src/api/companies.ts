import { z } from 'zod';

export const userCompanyRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.string(),
});

export type UserCompanyRow = z.infer<typeof userCompanyRowSchema>;
