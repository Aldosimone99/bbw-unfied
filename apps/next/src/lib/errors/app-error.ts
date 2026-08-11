export type AppErrorCode = "INVALID_INPUT" | "UNAUTHENTICATED" | "FORBIDDEN" | "INFRASTRUCTURE";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super("UNAUTHENTICATED", "Authentication is required.");
    this.name = "UnauthenticatedError";
  }
}

export class InvalidInputError extends AppError {
  constructor(message = "The submitted data is invalid.") {
    super("INVALID_INPUT", message);
    this.name = "InvalidInputError";
  }
}

export class AuthorizationError extends AppError {
  constructor(permission: string) {
    super("FORBIDDEN", `Missing permission: ${permission}`);
    this.name = "AuthorizationError";
  }
}
