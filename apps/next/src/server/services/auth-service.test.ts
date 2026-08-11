import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../../lib/supabase/server";
import { loginAccount, requestRegistrationOtp } from "./auth-service";
import { requestBackend } from "../backend/server-request";

vi.mock("../../lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("../backend/server-request", () => ({ requestBackend: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const mockedRequestBackend = vi.mocked(requestBackend);
const signInWithPassword = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  mockedCreateClient.mockResolvedValue({ auth: { signInWithPassword } } as unknown as Awaited<ReturnType<typeof createClient>>);
});

describe("transition auth service", () => {
  it("requests registration OTP through the transition backend", async () => {
    mockedRequestBackend.mockResolvedValue({ ok: true, status: 200, data: { reference: "otp-ref", code: "123456" } });

    await expect(requestRegistrationOtp("person@example.test")).resolves.toEqual({ status: "success", reference: "otp-ref", code: "123456" });
    expect(mockedRequestBackend).toHaveBeenCalledWith("/auth/otp/send", expect.objectContaining({ method: "POST" }));
  });

  it("does not create a Supabase session when transition login rejects credentials", async () => {
    mockedRequestBackend.mockResolvedValue({ ok: false, status: 401, data: { error: "INVALID_CREDENTIALS" } });

    await expect(loginAccount({ email: "person@example.test", password: "wrong-password" })).resolves.toMatchObject({
      status: "error",
      error: { kind: "invalid_credentials" }
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
