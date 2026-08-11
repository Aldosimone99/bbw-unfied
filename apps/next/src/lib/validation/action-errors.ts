import type { ZodError } from "zod";

export type FieldErrors = Record<string, string[]>;

export function getFieldErrors(error: ZodError): FieldErrors {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0];

    if (typeof field !== "string") {
      return errors;
    }

    errors[field] = [...(errors[field] ?? []), issue.message];
    return errors;
  }, {});
}
