// Guard the live project. The projects that run against the deployed app and engine (live-chromium, live-api) must never be
// reachable by accident: not by a stray `--`, not by `--list`, not by a filter that fails to filter. They are only DEFINED when
// the e2e account is in the environment, and when it is, the config REFUSES TO LOAD unless LIVE_E2E_GO=1 is set too. So every
// way of invoking playwright with those credentials, listing included, stops with a hard error and touches nothing.
export const LIVE_GO_VARIABLE = "LIVE_E2E_GO";

export function liveProjectsEnabled(env: Record<string, string | undefined>): boolean {
  if (!env.E2E_EMAIL) return false;
  if (env[LIVE_GO_VARIABLE] !== "1") {
    throw new Error(
      `The live Playwright projects run against production. ${LIVE_GO_VARIABLE}=1 must be set to use them (E2E_EMAIL is set, ` +
        `${LIVE_GO_VARIABLE} is not). Unset E2E_EMAIL to run only the local projects.`,
    );
  }
  return true;
}
