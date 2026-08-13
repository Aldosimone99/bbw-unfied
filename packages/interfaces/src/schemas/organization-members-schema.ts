import { z } from 'zod';

export const organizationMemberRoleSchema = z.object({
  code: z.string().min(1),
  displayName: z.string().min(1),
}).strict();

export const organizationMemberSchema = z.object({
  membershipId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  status: z.enum(['pending', 'active', 'suspended', 'revoked']),
  joinedAt: z.string().nullable(),
  roles: z.array(organizationMemberRoleSchema),
  isOrganizationOwner: z.boolean(),
}).strict();

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationMemberRole = z.infer<typeof organizationMemberRoleSchema>;
