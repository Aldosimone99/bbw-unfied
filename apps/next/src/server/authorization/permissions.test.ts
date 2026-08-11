import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../lib/errors/app-error";
import { UnauthenticatedError } from "../../lib/errors/app-error";
import { createClient } from "../../lib/supabase/server";
import { getCurrentUser } from "../auth/current-user";
import { loadAuthorizationContext, type LoadedAuthorizationContext } from "./context";
import { assertPermission, can, hasPermission, requirePermission } from "./permissions";

vi.mock("../../lib/supabase/server", () => ({
  createClient: vi.fn()
}));

vi.mock("../auth/current-user", () => ({
  getCurrentUser: vi.fn()
}));

vi.mock("./context", () => ({
  loadAuthorizationContext: vi.fn()
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedLoadAuthorizationContext = vi.mocked(loadAuthorizationContext);

const authorizationContext: LoadedAuthorizationContext = {
  memberships: [],
  globalPermissions: ["dashboard.access"],
  organizationPermissions: [],
  permissions: ["dashboard.access"],
  activeOrganization: null
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedCreateClient.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>);
  mockedGetCurrentUser.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  mockedLoadAuthorizationContext.mockResolvedValue(authorizationContext);
});

describe("permission guards", () => {
  it("recognizes an assigned permission", () => {
    const permissions = new Set(["dashboard.access"] as const);
    expect(hasPermission(permissions, "dashboard.access")).toBe(true);
  });

  it("rejects a missing permission", () => {
    const permissions = new Set(["profile.read_own"] as const);

    expect(() => assertPermission(permissions, "dashboard.access")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN", name: AuthorizationError.name })
    );
  });

  it("returns false when the user is not authenticated", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    await expect(can("dashboard.access")).resolves.toBe(false);
    await expect(requirePermission("dashboard.access")).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("checks permissions through the current authorization context", async () => {
    await expect(can("dashboard.access")).resolves.toBe(true);
    await expect(can("organization.read")).resolves.toBe(false);
    await expect(requirePermission("dashboard.access")).resolves.toBeUndefined();
    await expect(requirePermission("organization.read")).rejects.toBeInstanceOf(AuthorizationError);
  });
});
