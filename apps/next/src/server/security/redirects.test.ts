import { describe, expect, it } from "vitest";

import { resolveSafePostLoginRedirect } from "./redirects";

describe("safe post-login redirects", () => {
  it("allows the requested canonical internal path", () => {
    expect(resolveSafePostLoginRedirect("/dashboard?tab=overview", "/dashboard")).toBe(
      "/dashboard?tab=overview"
    );
  });

  it("rejects external URLs and protocol-relative URLs", () => {
    expect(resolveSafePostLoginRedirect("https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(resolveSafePostLoginRedirect("//evil.example/dashboard", "/dashboard")).toBe("/dashboard");
  });

  it("rejects paths outside the allowlist", () => {
    expect(resolveSafePostLoginRedirect("/settings", "/dashboard")).toBe("/dashboard");
    expect(resolveSafePostLoginRedirect("/admin", "/dashboard")).toBe("/dashboard");
  });

  it("rejects malformed path traversal variants", () => {
    expect(resolveSafePostLoginRedirect("/\\evil.example", "/dashboard")).toBe("/dashboard");
    expect(resolveSafePostLoginRedirect("/dashboard/../admin", "/dashboard")).toBe("/dashboard");
  });
});
