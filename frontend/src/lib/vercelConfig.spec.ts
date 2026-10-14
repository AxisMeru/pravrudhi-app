import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Lead-2 (14 Oct): a merge to main must NOT deploy production. Vercel deployed fa68ce92 on a git trigger at 20:08, ungated. Production deploys only through the gated script (post_pro_deploy.py,
// which refuses a SHA without the full-suite record). This fails if anyone turns git deployments back on for main or for any other branch, or drops the ignoreCommand.
const vercel = JSON.parse(readFileSync(join(__dirname, "..", "..", "vercel.json"), "utf8")) as { git?: { deploymentEnabled?: Record<string, unknown> }; ignoreCommand?: string };

test("vercel.json: git deployments are OFF for main and for every other branch", () => {
  const d = vercel.git?.deploymentEnabled;
  assert.ok(d, "git.deploymentEnabled is present");
  assert.strictEqual(d.main, false, "main must be false: a merge to main must not deploy production");
  assert.strictEqual(d["*"], false, "every other branch must be false");
  for (const [branch, on] of Object.entries(d)) assert.strictEqual(on, false, `${branch} must not deploy on a git push`);
});

test("vercel.json keeps its ignoreCommand", () => {
  assert.equal(vercel.ignoreCommand, "bash scripts/vercel-ignore-build.sh");
});

// The build marker (L2A / R2, 14 Oct): the gate reads /build.json on the deployment and on the alias and requires both to equal the gated sha.
const SHA = "0123456789abcdef0123456789abcdef01234567";

test("build.json: a valid 40-hex BUILD_SHA is written; BUILD_SHA wins over VERCEL_GIT_COMMIT_SHA; the latter is the fallback", async () => {
  const { buildSha, buildJson } = await import("../../scripts/write-build-json.mjs");
  assert.equal(buildSha({ BUILD_SHA: SHA }), SHA);
  assert.equal(buildSha({ BUILD_SHA: SHA, VERCEL_GIT_COMMIT_SHA: "f".repeat(40) }), SHA);
  assert.equal(buildSha({ VERCEL_GIT_COMMIT_SHA: "f".repeat(40) }), "f".repeat(40));
  assert.equal(buildSha({ BUILD_SHA: "", VERCEL_GIT_COMMIT_SHA: "f".repeat(40) }), "f".repeat(40));
  assert.deepEqual(JSON.parse(buildJson({ BUILD_SHA: SHA })), { sha: SHA }, "exactly one key: nothing else is written");
});

test("build.json: a missing or malformed sha is 'unknown', never anything else", async () => {
  const { buildSha, buildJson } = await import("../../scripts/write-build-json.mjs");
  for (const env of [{}, { BUILD_SHA: "" }, { BUILD_SHA: "abc" }, { BUILD_SHA: SHA.toUpperCase() }, { BUILD_SHA: SHA + "0" }, { BUILD_SHA: `${SHA}\n; echo` }, { BUILD_SHA: "main" }, { BUILD_SHA: "g".repeat(40) }]) {
    assert.equal(buildSha(env as Record<string, string>), "unknown", JSON.stringify(env));
  }
  assert.deepEqual(JSON.parse(buildJson({})), { sha: "unknown" });
});

test("build.json is wired as the prebuild step and the generated file is gitignored", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts.prebuild, "node scripts/write-build-json.mjs");
  const ignore = readFileSync(join(__dirname, "..", "..", "..", ".gitignore"), "utf8").split("\n").map((l) => l.trim());
  assert.ok(ignore.includes("frontend/public/build.json"), "public/build.json is generated, not committed");
});
