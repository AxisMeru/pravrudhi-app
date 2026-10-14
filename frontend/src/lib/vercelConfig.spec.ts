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
