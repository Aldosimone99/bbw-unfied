import { describe, expect, it } from "vitest";

import { mapAuthError } from "./map-auth-error";

describe("mapAuthError", () => {
  it("maps an existing email", () => {
    expect(mapAuthError({ code: "user_already_exists", message: "User already registered" }, "register")).toEqual({
      kind: "email_already_registered",
      message: "Esiste già un account associato a questa email"
    });

    expect(mapAuthError({ code: "EMAIL_ALREADY_EXISTS" }, "register")).toEqual({
      kind: "email_already_registered",
      message: "Esiste già un account associato a questa email"
    });
  });

  it("maps a weak password", () => {
    expect(mapAuthError({ code: "weak_password", message: "Password is too weak" }, "register")).toEqual({
      kind: "weak_password",
      message: "La password non rispetta i requisiti richiesti."
    });
  });

  it("maps a rate limit", () => {
    expect(mapAuthError({ status: 429, message: "Too many requests" }, "register")).toEqual({
      kind: "rate_limited",
      message: "Troppe richieste. Attendi qualche minuto e riprova."
    });
  });

  it("maps unknown registration errors generically", () => {
    expect(mapAuthError({ code: "unexpected_error", message: "Internal details" }, "register")).toEqual({
      kind: "generic",
      message: "Non è stato possibile creare l’account. Riprova."
    });
  });

  it("keeps every login error generic", () => {
    expect(mapAuthError({ code: "user_already_exists" }, "login")).toEqual({
      kind: "invalid_credentials",
      message: "Email o password non corrette."
    });
  });
});
