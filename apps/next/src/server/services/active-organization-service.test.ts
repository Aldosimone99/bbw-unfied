import { beforeEach, describe, expect, it, vi } from "vitest";

import { cookies } from "next/headers";

import { AuthorizationError, InvalidInputError } from "../../lib/errors/app-error";
import { getCurrentUser } from "../auth/current-user";
import type { MembershipSummary } from "../../types/authorization";
import { requireOrganizationMembership } from "./membership-service";
import {
  resolveActiveOrganization,
  setActiveOrganization
} from "./active-organization-service";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("./membership-service", () => ({ requireOrganizationMembership: vi.fn() }));

const mockedCookies = vi.mocked(cookies);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedRequireOrganizationMembership = vi.mocked(requireOrganizationMembership);

const organizationId = "00000000-0000-4000-8000-000000000001";
const membership: MembershipSummary = {
  id: "00000000-0000-4000-8000-000000000002",
  organizationId,
  organizationDisplayName: "Studio BBW",
  organizationTypeCode: "independent_practice",
  organizationTypeDisplayName: "Studio professionale",
  organizationStatus: "active",
  status: "active",
  joinedAt: null,
  roles: []
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetCurrentUser.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  mockedRequireOrganizationMembership.mockResolvedValue(membership);
  mockedCookies.mockResolvedValue({
    get: vi.fn(),
    set: vi.fn()
  } as unknown as Awaited<ReturnType<typeof cookies>>);
});

describe("active organization selection", () => {
  it("uses the first active organization when there is no valid cookie", () => {
    const second = { ...membership, id: "membership-3", organizationId: "organization-2" };
    expect(resolveActiveOrganization([membership, second], "missing")?.organizationId).toBe(organizationId);
  });

  it("returns null after the active membership is removed", () => {
    expect(resolveActiveOrganization([{ ...membership, status: "revoked" }], organizationId)).toBeNull();
  });

  it("validates the client value and persists only a verified membership", async () => {
    await setActiveOrganization(organizationId);

    expect(mockedRequireOrganizationMembership).toHaveBeenCalledWith({ userId: "user-1", organizationId });
    expect((await mockedCookies.mock.results[0]?.value).set).toHaveBeenCalledWith(
      "bbw-active-organization",
      organizationId,
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
  });

  it("rejects a manipulated or unauthorized organization id", async () => {
    await expect(setActiveOrganization("not-a-uuid")).rejects.toBeInstanceOf(InvalidInputError);
    mockedRequireOrganizationMembership.mockRejectedValueOnce(new AuthorizationError("organization.membership"));
    await expect(setActiveOrganization(organizationId)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
