import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { LIVE_GO_VARIABLE, liveProjectsEnabled } from "../../playwright.live-guard";

const FRONTEND = join(__dirname, "..", "..");
const CREDENTIALS = ["E2E_EMAIL", "E2E_PASSWORD"];

/** An env whose reads are recorded: the guard's reads are the thing under test. */
function spyEnv(values: Record<string, string>): { env: Record<string, string | undefined>; reads: string[] } {
  const reads: string[] = [];
  const env = new Proxy(values, {
    get: (t, k: string) => { reads.push(String(k)); return t[k]; },
    has: (t, k: string) => { reads.push(String(k)); return k in t; },
    ownKeys: () => { reads.push("<keys>"); return Reflect.ownKeys(values); },
  }) as Record<string, string | undefined>;
  return { env, reads };
}

test("the guard is fail-closed: with the go flag unset there are no live projects, whatever else is in the environment", () => {
  for (const go of [undefined, "", "0", "true", "yes", " 1", "1 "]) {
    assert.equal(liveProjectsEnabled({ E2E_EMAIL: "someone", E2E_PASSWORD: "x", ...(go === undefined ? {} : { [LIVE_GO_VARIABLE]: go }) }), false, String(go));
  }
  assert.equal(liveProjectsEnabled({}), false);
});

test("the flag-unset path never reads E2E_EMAIL or E2E_PASSWORD (a mocked env records every read)", () => {
  for (const go of [undefined, "0", "true"]) {
    const { env, reads } = spyEnv({ E2E_EMAIL: "someone", E2E_PASSWORD: "x", ...(go === undefined ? {} : { [LIVE_GO_VARIABLE]: go }) });
    assert.equal(liveProjectsEnabled(env), false);
    for (const name of CREDENTIALS) assert.ok(!reads.includes(name), `${name} was read with the flag ${String(go)}`);
    assert.ok(!reads.includes("<keys>"), "the environment was enumerated");
  }
});

test("with the go flag and the account the live projects are enabled; with the flag but no account the guard stops without printing a value", () => {
  assert.equal(liveProjectsEnabled({ LIVE_E2E_GO: "1", E2E_EMAIL: "someone", E2E_PASSWORD: "x" }), true);
  for (const env of [{ LIVE_E2E_GO: "1" }, { LIVE_E2E_GO: "1", E2E_EMAIL: "someone-secret" }, { LIVE_E2E_GO: "1", E2E_PASSWORD: "pw-secret" }]) {
    assert.throws(() => liveProjectsEnabled(env), (e: Error) => /not in the environment/.test(e.message) && !/someone-secret|pw-secret/.test(e.message));
  }
});

test("the config and the guard are the only gate: the config never names the credential variables, and the guard never logs", () => {
  const config = readFileSync(join(FRONTEND, "playwright.config.ts"), "utf8");
  for (const name of CREDENTIALS) assert.ok(!config.includes(name), `playwright.config.ts names ${name}`);
  assert.match(config, /liveProjectsEnabled\(process\.env\)/);
  const guard = readFileSync(join(FRONTEND, "playwright.live-guard.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(guard, /console\.|process\.stdout|process\.stderr/);
  // the four credential-reading specs are only ever run by a live project (the local project ignores them), so nothing local loads them
  for (const spec of ["live.spec.ts", "matters-live.spec.ts", "nyaya-live.spec.ts", "demo-live.spec.ts", "screening-live.spec.ts", "partner-api-live.spec.ts"]) {
    assert.ok(config.includes(`"${spec}"`), `${spec} is named in the config`);
  }
  assert.match(config, /testIgnore:\s*\[[\s\S]*"live\.spec\.ts"[\s\S]*"partner-api-live\.spec\.ts"/);
});

// The real config, loaded by the real playwright CLI.
function playwright(args: string[], env: Record<string, string>): { code: number; out: string } {
  try {
    const out = execFileSync("npx", ["playwright", "test", ...args], { cwd: FRONTEND, env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

test("the real config has no live project unless the go flag is set, even with the account in the environment", () => {
  const envs: Record<string, string>[] = [{}, { E2E_EMAIL: "someone-secret", E2E_PASSWORD: "pw-secret" }, { E2E_EMAIL: "someone-secret", E2E_PASSWORD: "pw-secret", LIVE_E2E_GO: "0" }];
  for (const env of envs) {
    const listed = playwright(["--list"], env);
    assert.equal(listed.code, 0, listed.out);
    assert.doesNotMatch(listed.out, /live-chromium|live-api/);
    const asked = playwright(["--list", "--project=live-chromium"], env);
    assert.notEqual(asked.code, 0, "asking for the live project by name must fail when it is not defined");
    assert.doesNotMatch(asked.out, /someone-secret|pw-secret/);
  }
});

test("with the go flag and the account the real config defines the live projects", () => {
  const live = playwright(["--list", "--project=live-chromium"], { E2E_EMAIL: "someone", E2E_PASSWORD: "x", LIVE_E2E_GO: "1" });
  assert.equal(live.code, 0, live.out);
  assert.match(live.out, /live-chromium/);
});
