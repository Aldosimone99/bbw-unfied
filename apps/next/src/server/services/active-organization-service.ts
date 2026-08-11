import { cookies } from "next/headers";

import { AuthorizationError, InvalidInputError, UnauthenticatedError } from "../../lib/errors/app-error";
import { activeOrganizationInputSchema } from "../../lib/validation/organization";
import type { MembershipSummary } from "../../types/authorization";
import { getPostLoginContext } from "./post-login-service";

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

  const context = await getPostLoginContext();
  if (!context.user) {
    throw new UnauthenticatedError();
  }

  const membership = context.memberships.find(
    (candidate) => candidate.organizationId === parsed.data.organizationId
  );
  if (!membership) {
    throw new AuthorizationError("organization.context");
  }

  (await cookies()).set(activeOrganizationCookieName, membership.organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return membership;
}
