import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { INNOCENT_SAMPLES, promiseHits, PROMISE_SAMPLES, WIDE_TOPIC } from "../../e2e/support/noTrainingPromise";
import { REVIEWED } from "../../e2e/support/reviewedSentences";

// The app states nothing about how the models handle submissions beyond what the code enforces (R1/Lead-2, 13 Oct). The scan covers every text file that ships or runs.
const frontend = join(__dirname, "..", "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "test-results", "playwright-report", ".git", "coverage", ".film-tools"]); // .film-tools is the local, gitignored film-rendering workspace (#255): third-party player code that is never committed
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|html|css|txt|svg|yml|yaml|toml|vtt)$/i;
// Exact exemptions, each with its reason:
const EXEMPT_FILES = new Map<string, string>([
  ["src/lib/fixtures/engineOpenapiV1.json", "the pinned engine contract: the default text of its retention_notice field, which the app never displays; goes when the engine text changes"],
  ["src/lib/fixtures/engineOpenapiV1.source.json", "the same pinned engine contract, source form"],
  ["package-lock.json", "dependency names, not copy"],
  ["src/lib/noTrainingPromise.spec.ts", "this scan quotes the one sentence it exempts, in its rows.json-only exemption list"],
  ["e2e/support/reviewedSentences.ts", "the reviewed list quotes the benchmark sentence that is exempt above, split as the scan splits it"],
]);
// Exact sentences exempt in ONE named file only (R2 finding 4: never a global exemption); each with its reason:
const EXEMPT_SENTENCES_IN = new Map<string, readonly string[]>([
  // R1's "About this run" disclosure of the open-weight reference arms (15 Oct), copied by the data build from the signed manifest's overlap_check: it says WE did not train that model; it says nothing about what happens to a submission
  ["src/data/nyayasiddhi/rows.json", ["not checked: public open-weight model used as released, no training by us"]],
]);

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

test("every file that ships or runs is free of promises about how models handle submissions", () => {
  const hits: string[] = [];
  for (const f of walk(frontend)) {
    const rel = relative(frontend, f);
    if (EXEMPT_FILES.has(rel)) continue;
    let text = readFileSync(f, "utf8");
    for (const s of EXEMPT_SENTENCES_IN.get(rel) ?? []) text = text.split(s).join(" ");
    const h = promiseHits(text);
    if (h.length) hits.push(`${rel}: ${h.join(" | ").slice(0, 120)}`);
  }
  assert.deepEqual(hits, []);
});

test("each sentence exemption is scoped to its own file and is still in it (a stale or global exemption hides a future promise)", () => {
  for (const [rel, sentences] of EXEMPT_SENTENCES_IN) for (const s of sentences) assert.ok(readFileSync(join(frontend, rel), "utf8").includes(s), `${rel}: exempt sentence no longer present: ${s}`);
});

test("each exemption still exists and still needs to (a stale exemption hides a future promise)", () => {
  for (const [rel] of EXEMPT_FILES) { try { statSync(join(frontend, rel)); } catch { assert.fail(`${rel} is exempt but missing`); } }
});

// FAIL-CLOSED (R2, 13 Oct): the pattern rule above is the first filter and can miss a new wording. So every sentence in a SHIPPED file (src/ non-spec, public/) that
// mentions teaching, tuning, scoring or improving a model must be on the reviewed list, exactly as split here, so a reader (R1) has looked at it.
const splitSentences = (text: string): string[] => text.replace(/\s+/g, " ").split(/(?<=[.;!?])\s+|["{}\[\]]/).map((s) => s.trim());
const shippedFiles = () => walk(frontend).map((f) => relative(frontend, f)).filter((rel) => (rel.startsWith("src/") || rel.startsWith("public/")) && !/\.spec\.ts$/.test(rel) && !/engineOpenapiV1/.test(rel));

test("every shipped sentence about teaching, tuning, scoring or improving a model is on the reviewed list", () => {
  const unreviewed: string[] = [];
  for (const rel of shippedFiles()) {
    const listed = new Set(REVIEWED[rel]?.sentences ?? []);
    for (const s of new Set(splitSentences(readFileSync(join(frontend, rel), "utf8")).filter((x) => WIDE_TOPIC.test(x)))) if (!listed.has(s)) unreviewed.push(`${rel}: ${s.slice(0, 140)}`);
  }
  assert.deepEqual(unreviewed, [], "a new sentence of this kind needs R1's read, then an entry in e2e/support/reviewedSentences.ts");
});

test("every reviewed entry is still in its file and still matches the filter (a stale entry hides a future change)", () => {
  const files = new Set(shippedFiles());
  for (const [rel, { reason, sentences }] of Object.entries(REVIEWED)) {
    assert.ok(files.has(rel), `${rel} is on the reviewed list but is not a shipped file`);
    assert.ok(reason.length > 8, `${rel} needs a reason`);
    const present = new Set(splitSentences(readFileSync(join(frontend, rel), "utf8")));
    for (const s of sentences) {
      assert.ok(present.has(s), `${rel}: reviewed sentence no longer present: ${s.slice(0, 100)}`);
      assert.ok(WIDE_TOPIC.test(s), `${rel}: reviewed sentence no longer matches the filter: ${s.slice(0, 100)}`);
    }
  }
});
