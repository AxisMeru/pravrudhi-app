// Fail-closed guard for the live projects. The projects that run against the deployed app and engine (live-chromium, live-api) type a real account into the hosted
// sign-in, so they must never be reachable from CI or an agent session: not by a stray `--`, not by `--list`, not because the account happens to be in the environment.
// They are DEFINED only when the operator sets LIVE_E2E_GO=1 (the one name, here and nowhere else). With the flag unset this function reads nothing else from the
// environment: E2E_EMAIL and E2E_PASSWORD are never touched, so a credential left in an environment is inert, and no path here logs or prints either value.
export const LIVE_GO_VARIABLE = "LIVE_E2E_GO";

export function liveProjectsEnabled(env: Record<string, string | undefined>): boolean {
  if (env[LIVE_GO_VARIABLE] !== "1") return false;
  // The operator asked for the live projects: the account must then be present (the check reads presence only; the values are never used or printed here).
  if (!env.E2E_EMAIL || !env.E2E_PASSWORD) {
    throw new Error(`${LIVE_GO_VARIABLE}=1 is set but the e2e account is not in the environment (see README "Testing"). The live projects were not defined.`);
  }
  return true;
}
