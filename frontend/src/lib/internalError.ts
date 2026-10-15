import { ApiError } from "./api";

/**
 * The engine's code for any unhandled exception (engine 0.6.18, #499): HTTP 500 {"error":"internal_error","detail":"..."}; before it the app saw {"detail":"Internal Server Error"}. The app maps this and the old bare
 * 500 alike, on every surface that calls the engine (Screening plain and assisted, Matters, Citations page and panel, Intake), to ONE reader-facing sentence; the code, the status and the engine's detail never reach the page.
 */
export const INTERNAL_ERROR_CODE = "internal_error";

/** R1's sentence (15 Oct, byte-exact): shown for an internal error on every surface, replacing the whole generic line. (null would keep each surface's own generic line.) */
export const INTERNAL_ERROR_LINE: string | null = "Something went wrong on our side, so this request was not completed. Try again in a moment.";

/** An unhandled engine exception: HTTP 500 with the code internal_error, or the old bare 500. */
export function isInternalError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 500;
}

/** The line for an internal error: R1's sentence once it exists, else the surface's own generic line. `line` is injectable for tests. */
export function internalErrorLine(fallback: string, line: string | null = INTERNAL_ERROR_LINE): string {
  return line ?? fallback;
}
