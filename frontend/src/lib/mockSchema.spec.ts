import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { mockViolations } from "./mockSchema";

test("the pinned engine schema is the file its source record names", () => {
  const dir = join(__dirname, "fixtures");
  const rec = JSON.parse(readFileSync(join(dir, "engineOpenapiV1.source.json"), "utf8")) as { sha256: string; source: string; commit: string };
  assert.equal(createHash("sha256").update(readFileSync(join(dir, "engineOpenapiV1.json"))).digest("hex"), rec.sha256);
  assert.ok(rec.source && rec.commit);
});

const element = { element: "e", status: "established", is_denial: false, claimed: true, p_established: 0.9, fact_id: "F1", quote: null, start: null, end: null, quote_check: null, attempts: 1, occurrences: 1, offsets_source: null, error: null, quote_source: "whole_fact", screening_signal: null, citation_note: "n" };
const GOOD = {
  run_id: "r", judge: "j", score_sha256: "a".repeat(64), provenance: "p",
  facts: [{ id: "F1", sha256: "b".repeat(64) }],
  contracts: [{ contract_id: "c", outcome: "ABSTAIN", reason: "missing_element", elements: [element], assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, citations: [] }],
};

test("an answer shaped like production's passes", () => {
  assert.deepEqual(mockViolations("analyse-facts", GOOD), []);
});

test("PLANTED: a mock whose facts carry text, a field production never sends, fails", () => {
  const bad = { ...GOOD, facts: [{ id: "F1", text: "a fact", sha256: "b".repeat(64) }] };
  assert.match(mockViolations("analyse-facts", bad).join("\n"), /facts\[0\]\.text: production never sends this key/);
});

test("planted: an unknown key, a missing required key and a wrong type are each caught", () => {
  assert.match(mockViolations("analyse-facts", { ...GOOD, surprise: 1 }).join("\n"), /surprise: not in the engine schema/);
  const noRun: Record<string, unknown> = { ...GOOD };
  delete noRun.run_id;
  assert.match(mockViolations("analyse-facts", noRun).join("\n"), /missing required "run_id"/);
  assert.match(mockViolations("analyse-facts", { ...GOOD, judge: 3 }).join("\n"), /judge: expected string/);
});

test("verify-citations: the full answer passes, a partial one does not", () => {
  const full = { result: "VERIFIED", note: "n", status: "VERIFIED", label: "l", verified: true, preview: false };
  assert.deepEqual(mockViolations("verify-citations", full), []);
  assert.match(mockViolations("verify-citations", { result: "NOT_IN_INDEX", note: "n" }).join("\n"), /missing required "status"/);
});

test("every e2e spec that mocks analyse-facts or verify-citations uses the schema-checked test", () => {
  const dir = join(__dirname, "..", "..", "e2e");
  const bad = readdirSync(dir).filter((f) => f.endsWith(".spec.ts")).filter((f) => {
    const s = readFileSync(join(dir, f), "utf8");
    return /page\.route\([^)]*\/api\/v1\/(analyse-facts|verify-citations)/.test(s) && !s.includes("./support/engineTest");
  });
  assert.deepEqual(bad, [], "these specs mock an engine answer without the schema check");
});
