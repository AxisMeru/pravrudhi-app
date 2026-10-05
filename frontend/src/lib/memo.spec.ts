import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyseFactsResult } from "./api";

// Synthetic fixture: toy facts only, no real matter text.
const FIXTURE: AnalyseFactsResult = {
  run_id: "run-TOY-1",
  judge: "toy-judge",
  score_sha256: "a".repeat(64),
  facts: [
    { id: "F1", text: "TOY: Kiran promised to marry Lata.\nHe never intended to.", sha256: "b".repeat(64) },
    { id: "F2", text: "TOY: Lata relied on it | and acted.", sha256: "c".repeat(64) },
  ],
  provenance: "toy",
  contracts: [
    {
      contract_id: "toy_proof",
      outcome: "PROOF",
      reason: "",
      assertions: null,
      lean: { verdict: "grounded", denied_claims: [], unlicensed_claims: [], omitted_claims: [] },
      lean_outcome: "grounded",
      uncertain: [],
      statute_text_mismatch: null,
      elements: [
        {
          element: "induces by deceit",
          is_denial: false,
          status: "established",
          claimed: true,
          p_established: 0.97,
          fact_id: "F1",
          quote: "never intended | to",
          start: 0,
          end: 5,
          quote_check: "ok",
          attempts: 1,
          occurrences: 1,
          offsets_source: "system",
          quote_source: "model",
          error: null,
        },
        {
          element: "no quote element",
          is_denial: false,
          status: "not_established",
          claimed: false,
          p_established: 0.02,
          fact_id: null,
          quote: null,
          start: null,
          end: null,
          quote_check: null,
          attempts: 1,
          occurrences: 0,
          offsets_source: null,
          quote_source: null,
          error: null,
        },
      ],
    },
    {
      contract_id: "toy_refer",
      outcome: "REFER_TO_LAWYER",
      reason: "second_judge_unavailable",
      assertions: null,
      lean: null,
      lean_outcome: null,
      uncertain: [],
      statute_text_mismatch: null,
      elements: [],
    },
    {
      contract_id: "toy_abstain",
      outcome: "ABSTAIN",
      reason: "judge_error",
      assertions: null,
      lean: null,
      lean_outcome: null,
      uncertain: [],
      statute_text_mismatch: null,
      elements: [],
    },
  ],
};

const OPTS = { engineVersion: "0.5.42", generatedAt: "2026-10-02T10:00:00Z" };

test("buildMemo: byte-identical for the same input", async () => {
  const { buildMemo } = await import("./memo");
  assert.equal(buildMemo(FIXTURE, OPTS), buildMemo(structuredClone(FIXTURE), OPTS));
});

test("buildMemo: carries run id, score hash, every fact hash, version, timestamp and the disclaimer", async () => {
  const { buildMemo, MEMO_DISCLAIMER } = await import("./memo");
  const md = buildMemo(FIXTURE, OPTS);
  for (const s of ["run-TOY-1", "a".repeat(64), "b".repeat(64), "c".repeat(64), "0.5.42", "2026-10-02T10:00:00Z", MEMO_DISCLAIMER]) {
    assert.ok(md.includes(s), `missing ${s.slice(0, 20)}`);
  }
  assert.match(MEMO_DISCLAIMER, /not legal advice/i);
  assert.match(MEMO_DISCLAIMER, /REFER/);
});

test("buildMemo: submitted facts appear and multi-line facts stay inside their quote block", async () => {
  const { buildMemo } = await import("./memo");
  const md = buildMemo(FIXTURE, OPTS);
  assert.ok(md.includes("> TOY: Kiran promised to marry Lata.\n> He never intended to."));
});

test("buildMemo: a quote with a pipe cannot break the element table; an element with no quote says so", async () => {
  const { buildMemo } = await import("./memo");
  const md = buildMemo(FIXTURE, OPTS);
  assert.ok(md.includes("never intended \\| to"));
  assert.match(md, /no supporting quote/i);
});

test("buildMemo: REFER and ABSTAIN state the reason in plain language and make no finding", async () => {
  const { buildMemo } = await import("./memo");
  const md = buildMemo(FIXTURE, OPTS);
  assert.match(md, /second check was temporarily unavailable/);
  assert.match(md, /No verdict was reached/i);
  assert.match(md, /judge_error/);
  const refer = md.split("## ").find((s) => s.startsWith("toy_refer"))!;
  assert.doesNotMatch(refer, /established|PROOF|DENIAL/i);
});

test("buildMemo: the Lean check is described as a structural check, never 'verified' or 'proven'", async () => {
  const { buildMemo } = await import("./memo");
  const md = buildMemo(FIXTURE, OPTS);
  assert.match(md, /structural check/i);
  assert.doesNotMatch(md, /\bverified\b|\bproven\b|proven in lean/i);
});

test("buildMemo: an unrecognised outcome fails closed", async () => {
  const { buildMemo } = await import("./memo");
  const odd = structuredClone(FIXTURE);
  odd.contracts[0].outcome = "SOMETHING_NEW";
  const md = buildMemo(odd, OPTS);
  assert.match(md, /not an outcome this app recognises/i);
});

test("memo module touches no network", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("./memo.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|engineFetch|^import (?!type)[^\n]*from "\.\/api"/m);
});

test("buildMemo: states the validation tier of the judge, so a verdict is never read as real-world accuracy", async () => {
  const { buildMemo, MEMO_VALIDATION_TIER } = await import("./memo");
  const memo = buildMemo(FIXTURE, { engineVersion: "0.5.42", generatedAt: "2026-10-02T10:00:00Z" });
  assert.ok(memo.includes(MEMO_VALIDATION_TIER));
  assert.match(MEMO_VALIDATION_TIER, /constructed, in-distribution sets/);
  assert.match(MEMO_VALIDATION_TIER, /not a measure of its accuracy on real matters/);
});
