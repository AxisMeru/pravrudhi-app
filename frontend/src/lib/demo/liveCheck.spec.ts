import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type { AnalyseFactsResult } from "../api";
import { buildMemo } from "../memo";
import { checkDemoResult, checkMemoText, expectationBinds, type DemoFixture } from "./liveCheck";

const FIXTURES = (JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "e2e", "fixtures", "demoFixtures.json"), "utf8")) as {
  fixtures: DemoFixture[];
}).fixtures;
const byId = (id: string): DemoFixture => FIXTURES.find((f) => f.id === id)!;
const SHA = "a".repeat(64);

// SYNTHETIC results shaped like the engine's: they exercise the checks, they are not engine output and prove nothing about the engine.
function resultFor(fixture: DemoFixture, facts: string[], overrides: Partial<AnalyseFactsResult["contracts"][number]> = {}): AnalyseFactsResult {
  const cid = fixture.contract_ids[0];
  const quote = facts[0].slice(0, 30);
  const proof = fixture.path === "proof";
  return {
    run_id: "run-SYN-1",
    judge: "synthetic",
    score_sha256: SHA,
    facts: facts.map((text, i) => ({ id: `F${i + 1}`, text, sha256: SHA })),
    provenance: "synthetic",
    retention_notice: "synthetic retention notice",
    contracts: [
      {
        contract_id: cid,
        outcome: proof ? "PROOF" : fixture.path === "refer" ? "REFER_TO_LAWYER" : "ABSTAIN",
        reason: proof ? "all_elements_established" : fixture.path === "refer" ? "contract_not_validated" : "missing_element",
        assertions: null,
        lean: null,
        lean_outcome: null,
        uncertain: [],
        statute_text_mismatch: null,
        citations: [{ act: "BNS", section: "69", corpus_id: "BNS/Section 69", in_corpus: true, title: "t" }],
        elements: proof
          ? [{ element: "e1", is_denial: false, status: "established", claimed: true, p_established: 0.9, fact_id: "F1", quote, start: 0, end: 30,
              quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: "system", quote_source: "model", error: null } as never]
          : [],
        ...overrides,
      },
    ],
  } as AnalyseFactsResult;
}

test("the fixtures: three paths, invented text in two wordings, all within the engine's limits, no recorded expectation yet", () => {
  assert.deepEqual(FIXTURES.map((f) => f.path).sort(), ["abstain", "proof", "refer"]);
  for (const f of FIXTURES) {
    for (const wording of [f.wordings.plain, f.wordings.formal]) {
      assert.ok(wording.length >= 1 && wording.length <= 8);
      for (const fact of wording) assert.ok(fact.trim().length > 0 && fact.length <= 4000);
    }
    assert.equal(expectationBinds(f), false, `${f.id}: no outcome is asserted before 3 recorded runs`);
  }
  assert.deepEqual(byId("proof-path").contract_ids, ["bns69"]);
  assert.equal(byId("refer-path").contract_ids[0], "bns316_misappropriation");
});

test("the fixture text carries nothing from the evaluation or the demo example, and no host path, email or CNR", () => {
  const all = JSON.stringify(FIXTURES);
  assert.doesNotMatch(all, /\/home\/|@[a-z0-9-]+\.[a-z]{2,}|HCMA|Crl\.O\.P|CNR|Raghunathan|Suchithra|Kiran|Lata/);
});

test("a well-formed result passes for each path", () => {
  for (const f of FIXTURES) {
    for (const facts of [f.wordings.plain, f.wordings.formal]) assert.deepEqual(checkDemoResult(resultFor(f, facts), facts, f), [], f.id);
  }
});

test("planted failures are each caught", () => {
  const f = byId("proof-path");
  const facts = f.wordings.plain;
  const good = () => resultFor(f, facts);
  const cases: [string, (r: AnalyseFactsResult) => void, RegExp][] = [
    ["no run id", (r) => (r.run_id = ""), /no run id/],
    ["bad score sha", (r) => (r.score_sha256 = "xyz"), /score sha256/],
    ["fact not echoed", (r) => (r.facts[0].text = "different"), /not echoed word for word/],
    ["fact count differs", (r) => r.facts.pop(), /echoed 2 facts for 3 submitted/],
    ["no retention notice", (r) => delete (r as { retention_notice?: string }).retention_notice, /retention notice/],
    ["missing elements", (r) => (r.contracts[0].elements = []), /no element rows/],
    ["a model-cited element without a quote", (r) => (r.contracts[0].elements[0].quote = null), /no quote/],
    ["a model quote not in the facts", (r) => (r.contracts[0].elements[0].quote = "words that were never submitted"), /not verbatim/],
    ["a whole-fact citation naming a fact that was not submitted", (r) => { r.contracts[0].elements[0].quote_source = "whole_fact"; r.contracts[0].elements[0].fact_id = "F99"; }, /is not one of the submitted facts/],
    ["an empty citation_note", (r) => (r.contracts[0].elements[0].citation_note = "  "), /citation_note is present but empty/],
    ["no established element in a PROOF", (r) => (r.contracts[0].elements[0].status = "not_established"), /no established element/],
    ["no citations", (r) => (r.contracts[0].citations = null), /no citations array/],
    ["empty citations", (r) => (r.contracts[0].citations = []), /citations is empty/],
    ["unknown outcome", (r) => (r.contracts[0].outcome = "MAYBE"), /outcome "MAYBE"/],
    ["missing contract card", (r) => (r.contracts = []), /0 result cards/],
    ["an unrequested contract", (r) => r.contracts.push({ ...r.contracts[0], contract_id: "bns85" }), /not requested/],
  ];
  for (const [name, mutate, expected] of cases) {
    const r = good();
    mutate(r);
    const violations = checkDemoResult(r, facts, f);
    assert.ok(violations.some((v) => expected.test(v)), `${name}: expected ${expected}, got ${JSON.stringify(violations)}`);
  }
});

test("a whole-fact citation passes with no quote claim: no quote, or a quote that is not verbatim, is not a violation", () => {
  const f = byId("proof-path");
  const facts = f.wordings.plain;
  for (const quote of [null, "words that were never submitted"]) {
    const r = resultFor(f, facts);
    const e = r.contracts[0].elements[0];
    e.quote_source = "whole_fact";
    e.quote = quote;
    assert.deepEqual(checkDemoResult(r, facts, f), [], String(quote));
  }
  const none = resultFor(f, facts);
  none.contracts[0].elements[0].quote_source = null;
  none.contracts[0].elements[0].quote = null;
  assert.deepEqual(checkDemoResult(none, facts, f), [], "no source means no claim");
});

test("a REFER with an unknown reason, and an ABSTAIN with an unknown reason, are caught", () => {
  const refer = byId("refer-path");
  const rf = refer.wordings.plain;
  assert.ok(checkDemoResult(resultFor(refer, rf, { reason: "something_new" }), rf, refer).some((v) => /not one this app knows/.test(v)));
  assert.ok(checkDemoResult(resultFor(refer, rf, { reason: "" }), rf, refer).some((v) => /no reason/.test(v)));
  const abstain = byId("abstain-path");
  const af = abstain.wordings.plain;
  assert.ok(checkDemoResult(resultFor(abstain, af, { reason: "something_new" }), af, abstain).some((v) => /ABSTAIN reason/.test(v)));
});

test("the recorded expectation binds only after 3 recorded runs, then a differing outcome fails", () => {
  const f = structuredClone(byId("proof-path"));
  const facts = f.wordings.plain;
  f.expect = { recorded_runs: 2, outcomes: { bns69: "REFER_TO_LAWYER" } };
  assert.deepEqual(checkDemoResult(resultFor(f, facts), facts, f), [], "2 runs: not binding");
  f.expect.recorded_runs = 3;
  assert.equal(expectationBinds(f), true);
  assert.ok(checkDemoResult(resultFor(f, facts), facts, f).some((v) => /differs from the recorded REFER_TO_LAWYER/.test(v)));
  f.expect.outcomes = { bns69: "PROOF" };
  assert.deepEqual(checkDemoResult(resultFor(f, facts), facts, f), []);
});

test("the memo check passes against the real buildMemo() and catches a memo missing a quote or the run id", () => {
  const f = byId("proof-path");
  const facts = f.wordings.plain;
  const r = resultFor(f, facts);
  const memo = buildMemo(r, { engineVersion: "0.0.0", generatedAt: "2026-01-01T00:00:00Z" });
  assert.deepEqual(checkMemoText(memo, r), []);
  assert.ok(checkMemoText(memo.replace(r.run_id, "x"), r).some((v) => /run id/.test(v)));
  assert.ok(checkMemoText(memo.replaceAll(r.contracts[0].elements[0].quote as string, "REMOVED"), r).some((v) => /quote is missing/.test(v)));
});

test("planted (R2): the memo's whole-fact branch needs the cited fact id, and the model-quote check applies to model quotes only", () => {
  const f = byId("proof-path");
  const facts = f.wordings.plain;
  const meta = { engineVersion: "0.0.0", generatedAt: "2026-01-01T00:00:00Z" };
  const whole = resultFor(f, facts);
  const e = whole.contracts[0].elements[0];
  e.quote_source = "whole_fact";
  const memo = buildMemo(whole, meta);
  assert.deepEqual(checkMemoText(memo, whole), []);
  assert.ok(checkMemoText(memo.replaceAll(e.fact_id as string, "ZZ-GONE"), whole).some((v) => /cited fact id is missing/.test(v)), "a memo without the cited fact id");
  // a whole-fact element's quote is not held to the memo; a model quote is
  assert.deepEqual(checkMemoText(memo.replaceAll(e.quote as string, "REMOVED"), whole).filter((v) => /quote is missing/.test(v)), []);
  const model = resultFor(f, facts);
  assert.ok(checkMemoText(buildMemo(model, meta).replaceAll(model.contracts[0].elements[0].quote as string, "REMOVED"), model).some((v) => /model quote is missing/.test(v)));
  // no quote_source: no memo claim at all
  const none = resultFor(f, facts);
  none.contracts[0].elements[0].quote_source = null;
  assert.deepEqual(checkMemoText(buildMemo(none, meta).replaceAll(none.contracts[0].elements[0].quote as string, "REMOVED").replaceAll("F1", "ZZ"), none), []);
});

test("pinned (R2): a missing or null citation_note on an established element is allowed (an older engine sends none); only a present but empty one is a violation", () => {
  const f = byId("proof-path");
  const facts = f.wordings.plain;
  for (const note of [undefined, null]) {
    const r = resultFor(f, facts);
    r.contracts[0].elements[0].citation_note = note;
    assert.deepEqual(checkDemoResult(r, facts, f), [], String(note));
  }
  const ok = resultFor(f, facts);
  ok.contracts[0].elements[0].citation_note = "an invented engine sentence";
  assert.deepEqual(checkDemoResult(ok, facts, f), []);
});

test("pinned (R2): only established elements are held to a citation; a non-established element is not checked, whatever it carries", () => {
  const f = byId("proof-path");
  const facts = f.wordings.plain;
  const r = resultFor(f, facts);
  r.contracts[0].elements.push({ ...r.contracts[0].elements[0], element: "e2", status: "not_established", quote_source: "whole_fact", fact_id: "F99", quote: "never submitted", citation_note: " " });
  assert.deepEqual(checkDemoResult(r, facts, f), []);
  r.contracts[0].elements[1].status = "established";
  assert.ok(checkDemoResult(r, facts, f).length >= 2, "the same element, once established, is checked");
});
