export const authErrorMessages = {
  emailAlreadyRegistered: "Esiste già un account associato a questa email",
  weakPassword: "La password non rispetta i requisiti richiesti.",
  rateLimited: "Troppe richieste. Attendi qualche minuto e riprova.",
  genericRegistration: "Non è stato possibile creare l’account. Riprova.",
  invalidCredentials: "Email o password non corrette."
} as const;

export type AuthErrorOperation = "login" | "register";

export type AuthErrorKind =
  | "email_already_registered"
  | "weak_password"
  | "rate_limited"
  | "invalid_credentials"
  | "generic";

export type AuthApplicationError = {
  kind: AuthErrorKind;
  message: string;
};

type AuthErrorDetails = {
  code?: string;
  message?: string;
  status?: number;
};

const weakPasswordCodes = new Set(["weak_password", "password_too_short"]);
const rateLimitCodes = new Set(["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"]);

function getAuthErrorDetails(error: unknown): AuthErrorDetails {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    status: typeof record.status === "number" ? record.status : undefined
  };
}

export function mapAuthError(error: unknown, operation: AuthErrorOperation): AuthApplicationError {
  if (operation === "login") {
    return {
      kind: "invalid_credentials",
      message: authErrorMessages.invalidCredentials
    };
  }

  const details = getAuthErrorDetails(error);

  if (
    details.code === "user_already_exists" ||
    details.code === "EMAIL_ALREADY_EXISTS" ||
    details.message === "User already registered"
  ) {
    return {
      kind: "email_already_registered",
      message: authErrorMessages.emailAlreadyRegistered
    };
  }

  if (details.code !== undefined && weakPasswordCodes.has(details.code)) {
    return {
      kind: "weak_password",
      message: authErrorMessages.weakPassword
    };
  }

  if (details.status === 429 || (details.code !== undefined && rateLimitCodes.has(details.code))) {
    return {
      kind: "rate_limited",
      message: authErrorMessages.rateLimited
    };
  }

  return {
    kind: "generic",
    message: authErrorMessages.genericRegistration
  };
}
