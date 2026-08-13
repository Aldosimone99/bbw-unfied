import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../../lib/supabase/server";
import { loginAccount, logoutAccount, registerAccount } from "./auth-service";
import { requestBackend } from "../backend/server-request";
import { clearActiveOperationalContext } from "./operational-context-cookie";

vi.mock("../../lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("../backend/server-request", () => ({ requestBackend: vi.fn() }));
vi.mock("./operational-context-cookie", () => ({ clearActiveOperationalContext: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const mockedRequestBackend = vi.mocked(requestBackend);
const mockedClearActiveOperationalContext = vi.mocked(clearActiveOperationalContext);
const signInWithPassword = vi.fn();
const setSession = vi.fn();
const signOut = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  mockedCreateClient.mockResolvedValue({ auth: { signInWithPassword, setSession, signOut } } as unknown as Awaited<ReturnType<typeof createClient>>);
});

describe("transition auth service", () => {
  it("does not create a Supabase session when transition login rejects credentials", async () => {
    mockedRequestBackend.mockResolvedValue({ ok: false, status: 401, data: { error: "INVALID_CREDENTIALS" } });

    await expect(loginAccount({ email: "person@example.test", password: "wrong-password" })).resolves.toMatchObject({
      status: "error",
      error: { kind: "invalid_credentials" }
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it("stores the backend session returned after a successful login", async () => {
    mockedRequestBackend.mockResolvedValue({
      ok: true,
      status: 200,
      data: { token: "access-token", refreshToken: "refresh-token" }
    });
    setSession.mockResolvedValue({ error: null });

    await expect(loginAccount({ email: "person@example.test", password: "Password123!" })).resolves.toEqual({ status: "success" });
    expect(setSession).toHaveBeenCalledWith({ access_token: "access-token", refresh_token: "refresh-token" });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("logs in through the backend after registration and stores the returned session", async () => {
    mockedRequestBackend
      .mockResolvedValueOnce({ ok: true, status: 201, data: { userId: "user-1" } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { token: "access-token", refreshToken: "refresh-token" } });
    setSession.mockResolvedValue({ error: null });

    await expect(registerAccount({
      email: "person@example.test",
      password: "Password123!",
      confirmPassword: "Password123!",
      acceptTerms: true,
      acceptPrivacy: true
    })).resolves.toEqual({ status: "redirect" });
    expect(mockedRequestBackend).toHaveBeenNthCalledWith(2, "/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("destroys the Supabase session and clears the active operational context on logout", async () => {
    signOut.mockResolvedValue({ error: null });
    mockedClearActiveOperationalContext.mockResolvedValue();

    await expect(logoutAccount()).resolves.toBeUndefined();

    expect(signOut).toHaveBeenCalledOnce();
    expect(mockedClearActiveOperationalContext).toHaveBeenCalledOnce();
  });
});
