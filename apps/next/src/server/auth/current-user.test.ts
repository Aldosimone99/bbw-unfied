import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentProfile, getCurrentUser } from "./current-user";
import { getTransitionAuthorizationContext } from "./transition-session";

vi.mock("./transition-session", () => ({ getTransitionAuthorizationContext: vi.fn() }));

const mockedGetAuthorizationContext = vi.mocked(getTransitionAuthorizationContext);

const profile = {
  id: "user-1",
  userId: "user-1",
  firstName: null,
  lastName: null,
  phone: null,
  requestedAccountType: null,
  operationalRole: null,
  accountTypeStatus: "not_required" as const,
  onboardingStatus: "profile_required" as const
};

const authorizationContext = {
  user: {
    id: "user-1",
    email: "person@example.test",
    tipo_utente: "privato" as const
  },
  profile,
  memberships: [],
  activeOrganization: null,
  globalPermissions: [],
  organizationPermissions: [],
  permissions: []
};

describe("current user", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reads identity and profile from the canonical authorization context", async () => {
    mockedGetAuthorizationContext.mockResolvedValue(authorizationContext);

    await expect(getCurrentUser()).resolves.toEqual({
      id: "user-1",
      email: "person@example.test"
    });
    await expect(getCurrentProfile()).resolves.toEqual(profile);
  });

  it("returns null when the backend cannot establish an authorized session", async () => {
    mockedGetAuthorizationContext.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(getCurrentProfile()).resolves.toBeNull();
  });
});
