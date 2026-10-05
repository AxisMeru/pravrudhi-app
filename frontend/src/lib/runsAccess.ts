// Runs are the operator's, in every edition (pravrudhi#249: the whole /api/runs family answers a non-admin 403).
// The interface hides the entry for anyone the engine does not call an admin and, if a run route is reached anyway
// (a bookmark, a stale tab), says so plainly instead of reporting an outage.

export const OPERATOR_ONLY_MESSAGE = "Runs are available to this engine's operator only.";

// The engine's own word for who is asking (`/api/me` `access`): "admin" is the operator; "member" is signed in but
// not on the allowlist; "none" is nobody. Anything else, including a missing value from an older engine, is not
// shown the entry: hiding is the safe default, and the engine refuses regardless.
export function canSeeRuns(access: string | undefined, isDemo: boolean = false): boolean {
  return isDemo || access === "admin";
}

export function isOperatorOnly(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 401 || status === 403;
}
