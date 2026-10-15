import { ApiError } from "./api";
import { INTAKE_SIGNED_IN_ONLY } from "./intake";
import { INTERNAL_ERROR_LINE, internalErrorLine, isInternalError } from "./internalError";
import { INTAKE_RATE_LIMITED, INTAKE_REFUSED, INTAKE_TIMEOUT, INTAKE_TOO_LONG, INTAKE_UNREADABLE } from "./intakeCopy";

/** The one plain line an Intake failure shows (a status line, never a raw code): signed-in only for 401/403, the too-long line for the engine's 503 intake_timeout, the refused line for a 422, the wait line for a 429 with Retry-After, otherwise the general line. */
export function intakeErrorLine(e: unknown, internalLine: string | null = INTERNAL_ERROR_LINE): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return INTAKE_SIGNED_IN_ONLY;
    if (e.status === 503 && e.code === "intake_timeout") return INTAKE_TIMEOUT;
    // app#342: a refused text (422) cannot succeed on a retry; a rate limit (429) says how long to wait. Never the engine's reason or detail.
    // #359: only the fact that the text was too long is used (the detail type), never the engine's words; any other 422 keeps the refused line
    if (e.status === 422) return e.validationTypes?.includes("string_too_long") ? INTAKE_TOO_LONG : INTAKE_REFUSED;
    if (e.status === 429) return e.retryAfter ? `${INTAKE_RATE_LIMITED} Seconds to wait: ${e.retryAfter}.` : INTAKE_UNREADABLE;
  }
  return isInternalError(e) ? internalErrorLine(INTAKE_UNREADABLE, internalLine) : INTAKE_UNREADABLE;
}
