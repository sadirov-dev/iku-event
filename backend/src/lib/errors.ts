/**
 * Errors carry a stable machine-readable `code`; the frontend translates the code
 * into Kyrgyz / Russian / English, so the API never sends user-facing prose.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "USER_BLOCKED"
  | "EMAIL_TAKEN"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "ANNOUNCEMENT_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "REGISTRATION_CLOSED"
  | "EVENT_FULL"
  | "EVENT_CANCELLED"
  | "ALREADY_REGISTERED"
  | "NOT_REGISTERED"
  | "INVALID_FILE"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    public details?: unknown,
  ) {
    super(code);
  }
}

export const notFound = (code: ErrorCode = "NOT_FOUND") => new AppError(404, code);
export const forbidden = () => new AppError(403, "FORBIDDEN");
