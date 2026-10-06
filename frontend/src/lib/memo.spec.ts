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

// -- "Provision text (for reference)" (Lead-2, 6 Oct; engine fields rule_text / judge_rule_text / rule_text_source) -------
// Toy provision text only (invented words, not a real provision).
const TOY_OFFICIAL = "TOY provision: whoever induces another by deceit to part with property commits the toy offence.";
const TOY_JUDGED = "TOY provision (shortened): whoever induces another by deceit commits the toy offence.";

test("buildMemo: a contract whose engine result carries rule_text gets one 'Provision text (for reference)' block, with the notice and the elements line", async () => {
  const { buildMemo, PROVISION_HEADING, PROVISION_ELEMENTS_LINE } = await import("./memo");
  const { STATUTE_NOTICE } = await import("./statuteNotice");
  const withText = structuredClone(FIXTURE);
  withText.contracts[0].rule_text = TOY_OFFICIAL;
  withText.contracts[0].rule_text_source = "Toy Act, section 1";
  const md = buildMemo(withText, OPTS);
  assert.equal(md.split(`### ${PROVISION_HEADING}`).length - 1, 1, "exactly one block for the one contract that has text");
  assert.ok(md.includes(`> ${TOY_OFFICIAL}`));
  assert.ok(md.includes("Recorded source: Toy Act, section 1"));
  assert.ok(md.includes(STATUTE_NOTICE), "the unofficial-text notice always travels with the provision text");
  assert.ok(md.includes(PROVISION_ELEMENTS_LINE));
  assert.match(PROVISION_ELEMENTS_LINE, /not extracted from the text below/);
  assert.match(PROVISION_ELEMENTS_LINE, /this tool's reading of the provision/);
  // The line sits between the heading and the text, so "the text below" is true.
  assert.ok(md.indexOf(PROVISION_HEADING) < md.indexOf(PROVISION_ELEMENTS_LINE) && md.indexOf(PROVISION_ELEMENTS_LINE) < md.indexOf(`> ${TOY_OFFICIAL}`));
  // The block sits AFTER that contract's element table (no restructure) and before the next contract.
  assert.ok(md.indexOf("| Element |") < md.indexOf(`### ${PROVISION_HEADING}`));
});

test("buildMemo: no mismatch note unless the engine sent the judge's own version", async () => {
  const { buildMemo, PROVISION_MISMATCH_LINE } = await import("./memo");
  const noJudge = structuredClone(FIXTURE);
  noJudge.contracts[0].rule_text = TOY_OFFICIAL;
  assert.ok(!buildMemo(noJudge, OPTS).includes(PROVISION_MISMATCH_LINE));
  const withJudge = structuredClone(noJudge);
  withJudge.contracts[0].judge_rule_text = TOY_JUDGED;
  const md = buildMemo(withJudge, OPTS);
  assert.ok(md.includes("The judge was shown this version of the provision, which is shorter or different from the provision text above; its findings were made against this version:"));
  assert.doesNotMatch(md, /rest on this version|official text above/);
  assert.ok(md.includes(`> ${TOY_JUDGED}`));
  assert.ok(md.indexOf(`> ${TOY_OFFICIAL}`) < md.indexOf(PROVISION_MISMATCH_LINE));
});

test("buildMemo: without rule_text (an older engine, or none sent) the memo is exactly what it was: nothing is invented", async () => {
  const { buildMemo, PROVISION_HEADING } = await import("./memo");
  const md = buildMemo(FIXTURE, OPTS);
  assert.ok(!md.includes(PROVISION_HEADING));
  const blank = structuredClone(FIXTURE);
  blank.contracts[0].rule_text = "   ";
  blank.contracts[0].judge_rule_text = "x"; // a judge text alone, with no official text, is not shown either
  assert.equal(buildMemo(blank, OPTS), md);
});

test("buildMemo: provision text with newlines stays inside its quote block", async () => {
  const { buildMemo } = await import("./memo");
  const two = structuredClone(FIXTURE);
  two.contracts[0].rule_text = "TOY line one\nTOY line two";
  const md = buildMemo(two, OPTS);
  assert.ok(md.includes("> TOY line one\n> TOY line two"));
});

test("buildMemo: the notice and a source link ALWAYS travel with the provision text; never a constructed or foreign link", async () => {
  const { buildMemo } = await import("./memo");
  const { STATUTE_NOTICE, INDIA_CODE_HOME } = await import("./statuteNotice");
  const cases: [string | null | undefined, string][] = [
    [undefined, INDIA_CODE_HOME],
    [null, INDIA_CODE_HOME],
    ["Toy Act, section 1", INDIA_CODE_HOME],
    ["https://indiacode.gov.in/act/toy/sections", "https://indiacode.gov.in/act/toy/sections"],
    ["Toy Act (https://www.indiacode.nic.in/handle/1/2)", "https://www.indiacode.nic.in/handle/1/2"],
    ["https://example.com/toy-act", INDIA_CODE_HOME],
    ["http://indiacode.gov.in/insecure", INDIA_CODE_HOME],
    ["https://evil-indiacode.gov.in.example.com/x", INDIA_CODE_HOME],
  ];
  for (const [source, link] of cases) {
    const r = structuredClone(FIXTURE);
    r.contracts[0].rule_text = TOY_OFFICIAL;
    r.contracts[0].rule_text_source = source;
    const md = buildMemo(r, OPTS);
    assert.ok(md.includes(`${STATUTE_NOTICE} Source: ${link}`), `${source}: the notice and its link are one line`);
    assert.equal((md.match(/Source: https:\/\//g) ?? []).length, 1, `${source}: exactly one link`);
  }
});
