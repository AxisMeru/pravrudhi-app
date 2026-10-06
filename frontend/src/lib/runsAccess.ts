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

// The law-firm surface shows the API keys and usage entry to an organisation admin only (the engine's word "admin");
// a missing value from an older engine hides it, and the engine refuses regardless.
export function canSeeApiKeys(access: string | undefined): boolean {
  return access === "admin";
}

// The notification bell and the workspace bootstrap are the operator's: the engine closes /api/notifications and
// /api/workspaces to members (Lead-2's #548 decision), so a member's interface neither shows the bell (no polling) nor
// provisions a workspace. The recorded public demo shows the bell as it always did.
export function canSeeNotifications(access: string | undefined, isDemo: boolean = false): boolean {
  return isDemo || access === "admin";
}

export function shouldBootstrapWorkspace(access: string | undefined, isDemo: boolean = false): boolean {
  return !isDemo && access === "admin";
}
