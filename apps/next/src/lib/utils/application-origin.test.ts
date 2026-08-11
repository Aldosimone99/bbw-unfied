import { describe, expect, it } from "vitest";

import { resolveApplicationOrigin } from "./application-origin";

describe("resolveApplicationOrigin", () => {
  it("uses the configured public site URL", () => {
    expect(resolveApplicationOrigin("https://bbw.example.com/", "http://localhost:3000")).toBe(
      "https://bbw.example.com"
    );
  });

  it("falls back to a local request origin during development", () => {
    expect(resolveApplicationOrigin(undefined, "http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("does not use an arbitrary request origin in production", () => {
    expect(resolveApplicationOrigin(undefined, "https://bbw.example.com")).toBeNull();
  });

  it("rejects malformed or credential-bearing site URLs", () => {
    expect(resolveApplicationOrigin("not-a-url", null)).toBeNull();
    expect(resolveApplicationOrigin("https://user:password@bbw.example.com", null)).toBeNull();
  });
});
