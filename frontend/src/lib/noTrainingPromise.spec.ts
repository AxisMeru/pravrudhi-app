import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { INNOCENT_SAMPLES, promiseHits, PROMISE_SAMPLES } from "../../e2e/support/noTrainingPromise";

// The app makes no promise about training or evaluation use that the code does not enforce (R1/Lead-2, 13 Oct). The scan covers every text file that ships or runs.
const frontend = join(__dirname, "..", "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "test-results", "playwright-report", ".git", "coverage"]);
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|html|css|txt|svg|yml|yaml|toml)$/i;
// Exact exemptions, each with its reason:
const EXEMPT_FILES = new Map<string, string>([
  ["src/lib/fixtures/engineOpenapiV1.json", "the pinned engine contract: the default text of its retention_notice field, which the app never displays; goes when the engine text changes"],
  ["src/lib/fixtures/engineOpenapiV1.source.json", "the same pinned engine contract, source form"],
  ["package-lock.json", "dependency names, not copy"],
]);
// One exact sentence, not a pattern: benchmark-set wording about test sets, not about user submissions.
const EXEMPT_SENTENCES = ["Model weights are not trained on these test sets by design"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

test("the scan's patterns catch each way of promising it and let the plain retention sentences through", () => {
  for (const s of PROMISE_SAMPLES) assert.ok(promiseHits(s).length > 0, `not caught: ${s}`);
  for (const s of INNOCENT_SAMPLES) assert.deepEqual(promiseHits(s), [], `false hit: ${s}`);
});

test("no file that ships or runs makes a promise about training or evaluation use of submissions", () => {
  const hits: string[] = [];
  for (const f of walk(frontend)) {
    const rel = relative(frontend, f);
    if (EXEMPT_FILES.has(rel)) continue;
    let text = readFileSync(f, "utf8");
    for (const s of EXEMPT_SENTENCES) text = text.split(s).join(" ");
    const h = promiseHits(text);
    if (h.length) hits.push(`${rel}: ${h.join(" | ").slice(0, 120)}`);
  }
  assert.deepEqual(hits, []);
});

test("each exemption still exists and still needs to (a stale exemption hides a future promise)", () => {
  for (const [rel] of EXEMPT_FILES) { try { statSync(join(frontend, rel)); } catch { assert.fail(`${rel} is exempt but missing`); } }
  const bench = readFileSync(join(frontend, "src/lib/benchmarks.ts"), "utf8");
  for (const s of EXEMPT_SENTENCES) assert.ok(bench.includes(s), `the exempt sentence is no longer in benchmarks.ts: ${s}`);
});
