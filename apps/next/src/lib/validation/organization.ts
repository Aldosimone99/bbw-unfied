import { z } from "zod";

export const activeOrganizationInputSchema = z.object({
  organizationId: z.string().uuid()
});
