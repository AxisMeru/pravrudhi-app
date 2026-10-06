import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { LIVE_GO_VARIABLE, liveProjectsEnabled } from "../../playwright.live-guard";

test("without the e2e account there are no live projects and nothing to guard", () => {
  assert.equal(liveProjectsEnabled({}), false);
  assert.equal(liveProjectsEnabled({ LIVE_E2E_GO: "1" }), false);
});

test("with the e2e account but without LIVE_E2E_GO=1 the guard is a hard error", () => {
  for (const go of [undefined, "", "0", "true", "yes", " 1"]) {
    assert.throws(() => liveProjectsEnabled({ E2E_EMAIL: "someone", [LIVE_GO_VARIABLE]: go }), /LIVE_E2E_GO=1 must be set/, String(go));
  }
});

test("with the e2e account and LIVE_E2E_GO=1 the live projects are enabled", () => {
  assert.equal(liveProjectsEnabled({ E2E_EMAIL: "someone", LIVE_E2E_GO: "1" }), true);
});

// The real config, loaded by the real playwright CLI: --list and any project filter stop before anything is loaded.
const FRONTEND = join(__dirname, "..", "..");
function playwright(args: string[], env: Record<string, string>): { code: number; out: string } {
  try {
    const out = execFileSync("npx", ["playwright", "test", ...args], { cwd: FRONTEND, env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } as NodeJS.ProcessEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

test("the real config refuses --list with the e2e account and no go, however it is filtered", () => {
  for (const args of [["--list"], ["--list", "--project=live-chromium"], ["--list", "--", "demo-live.spec.ts"]]) {
    const r = playwright(args, { E2E_EMAIL: "someone", E2E_PASSWORD: "x" });
    assert.notEqual(r.code, 0, args.join(" "));
    assert.match(r.out, /LIVE_E2E_GO=1 must be set/, args.join(" "));
  }
});

test("the real config lists only the local projects when the e2e account is absent, and the live ones only with the go", () => {
  const local = playwright(["--list"], {});
  assert.equal(local.code, 0);
  assert.doesNotMatch(local.out, /live-chromium|live-api/);
  const live = playwright(["--list", "--project=live-chromium"], { E2E_EMAIL: "someone", E2E_PASSWORD: "x", LIVE_E2E_GO: "1" });
  assert.equal(live.code, 0, live.out);
  assert.match(live.out, /live-chromium/);
});
