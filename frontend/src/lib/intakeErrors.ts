import { ApiError } from "./api";
import { INTAKE_SIGNED_IN_ONLY } from "./intake";
import { INTERNAL_ERROR_LINE, internalErrorLine, isInternalError } from "./internalError";
import { INTAKE_TIMEOUT, INTAKE_UNREADABLE } from "./intakeCopy";

/** The one plain line an Intake failure shows (a status line, never a raw code): signed-in only for 401/403, the too-long line for the engine's 503 intake_timeout, otherwise the general line. */
export function intakeErrorLine(e: unknown, internalLine: string | null = INTERNAL_ERROR_LINE): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return INTAKE_SIGNED_IN_ONLY;
    if (e.status === 503 && e.code === "intake_timeout") return INTAKE_TIMEOUT;
  }
  return isInternalError(e) ? internalErrorLine(INTAKE_UNREADABLE, internalLine) : INTAKE_UNREADABLE;
}
