import { cookies } from "next/headers";

import { InvalidInputError, UnauthenticatedError } from "../../lib/errors/app-error";
import { activeOrganizationInputSchema } from "../../lib/validation/organization";
import type { MembershipSummary } from "../../types/authorization";
import { getCurrentUser } from "../auth/current-user";
import { requireOrganizationMembership } from "./membership-service";

export const activeOrganizationCookieName = "bbw-active-organization";

export function resolveActiveOrganization(
  memberships: MembershipSummary[],
  requestedOrganizationId: string | null
): MembershipSummary | null {
  const activeMemberships = memberships.filter(
    (membership) => membership.status === "active" && membership.organizationStatus === "active"
  );

  if (requestedOrganizationId) {
    const requested = activeMemberships.find(
      (membership) => membership.organizationId === requestedOrganizationId
    );
    if (requested) {
      return requested;
    }
  }

  return activeMemberships[0] ?? null;
}

export async function getRequestedActiveOrganizationId(): Promise<string | null> {
  return (await cookies()).get(activeOrganizationCookieName)?.value ?? null;
}

export async function setActiveOrganization(organizationId: string): Promise<MembershipSummary> {
  const parsed = activeOrganizationInputSchema.safeParse({ organizationId });
  if (!parsed.success) {
    throw new InvalidInputError("Seleziona un’organizzazione valida.");
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthenticatedError();
  }

  const membership = await requireOrganizationMembership({
    userId: user.id,
    organizationId: parsed.data.organizationId
  });

  (await cookies()).set(activeOrganizationCookieName, membership.organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return membership;
}
