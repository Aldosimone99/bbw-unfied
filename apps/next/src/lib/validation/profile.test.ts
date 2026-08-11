import { describe, expect, it } from "vitest";

import { profileUpdateInputSchema } from "./profile";

describe("profile update validation", () => {
  it("normalizes personal data and an empty phone number", () => {
    const result = profileUpdateInputSchema.safeParse({
      firstName: "  Aldosimone ",
      lastName: " Di Rosa ",
      phone: "   "
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        firstName: "Aldosimone",
        lastName: "Di Rosa",
        phone: undefined
      });
    }
  });

  it("requires name and surname", () => {
    const result = profileUpdateInputSchema.safeParse({
      firstName: "",
      lastName: ""
    });

    expect(result.success).toBe(false);
  });
});
