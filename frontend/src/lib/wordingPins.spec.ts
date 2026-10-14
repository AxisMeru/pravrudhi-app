import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyseFactsContract, AnalyseFactsResult } from "./api";
import { STEPS } from "./demo/steps";
import { elementStatusPresentation } from "./elementStatus";
import { buildMemo } from "./memo";
import { bindingLegText, quoteCheckPresentation } from "./reasonText";
import { CAVEATS } from "./surfaceCopy";

// Pins for the O8 lib/ rewrites (#84): each changed string is held EXACTLY, so a mutant that restores the old word or drops a clause fails.
// Toy values only.

test("demo step 3 title and body, exactly (the Screening flow: the three chips and the cited fact)", () => {
  const s = STEPS.find((x) => x.title.startsWith("See which ingredients your facts support"));
  assert.ok(s);
  assert.equal(s.title, "See which ingredients your facts support");
  assert.equal(
    s.body,
    "Each ingredient is marked Supported by a fact, Not supported by these facts, or Needs your review, with the reason. A supported ingredient shows the fact of yours it cites, as you wrote it; nothing is filled in to look complete.",
  );
});

test("the element chips read 'supported by a fact' and 'not supported by these facts'", () => {
  assert.equal(elementStatusPresentation("established").label, "supported by a fact");
  assert.equal(elementStatusPresentation("not_established").label, "not supported by these facts");
  assert.equal(elementStatusPresentation("established").verdict, "established"); // the code value is unchanged: only the words moved
});

test("the binding-leg lines and the unknown quote-check fallback, exactly", () => {
  assert.equal(bindingLegText("primary"), "Not supported at the first check's confidence threshold.");
  assert.equal(bindingLegText("second"), "Not supported at the second check's confidence threshold.");
  assert.equal(bindingLegText(null), null);
  const u = quoteCheckPresentation("brand_new");
  assert.equal(u?.text, 'The check of the cited text gave a result this app does not recognise yet ("brand_new").');
  assert.equal(u?.unknown, true);
});

test("the how-to-read stack sentence cites facts and never quotes them", () => {
  const t = CAVEATS.find((c) => c.id === "stack")?.text;
  assert.equal(
    t,
    "Each offence is screened ingredient by ingredient: models read your facts and cite the facts they rely on, and a separate structure check confirms the right ingredients were covered. The structure check does not read your facts.",
  );
});

const el = (o: Record<string, unknown>) => ({
  element: "a promise", is_denial: false, status: "established", claimed: true, p_established: 0.5, fact_id: "F1", quote: "the whole fact | text",
  start: 0, end: 5, quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: "system", quote_source: "whole_fact", error: null, ...o,
});
const memo = (contracts: Partial<AnalyseFactsContract>[]) =>
  buildMemo(
    {
      run_id: "run-TOY", judge: "toy", score_sha256: "a".repeat(64), provenance: "toy",
      facts: [{ id: "F1", text: "TOY fact.", sha256: "b".repeat(64) }],
      contracts: contracts.map((c) => ({ contract_id: "toy", outcome: "PROOF", reason: "", assertions: null, lean: null, lean_outcome: null, uncertain: [], statute_text_mismatch: null, elements: [], ...c })),
    } as unknown as AnalyseFactsResult,
    { engineVersion: "0.6.0", generatedAt: "2026-10-08T10:00:00Z" },
  );

test("memo table: header with no score column (Lead-2, 13 Oct), cited fact with quotation marks only for a model quote", () => {
  const md = memo([{ elements: [el({}) as never, el({ element: "b", quote: "words a judge wrote", quote_source: "model" }) as never, el({ element: "c", quote: null, fact_id: null, quote_source: null }) as never] }]);
  assert.ok(md.includes("| Element | Status | Cited fact |"));
  assert.doesNotMatch(md, /Judge score|0\.50/);
  assert.ok(md.includes("| a promise | supported by a fact | the whole fact \\| text (F1) |"), md); // whole fact: no marks
  assert.ok(md.includes('| b | supported by a fact | "words a judge wrote" (F1) |'), md); // a model's words: marks
  assert.ok(md.includes("| c | supported by a fact | no cited fact |"), md);
});

test("memo: the two fallback sentences for a PROOF or DENIAL with an unknown reason, exactly", () => {
  const md = memo([{ outcome: "PROOF", reason: "unknown_code" }, { outcome: "DENIAL", reason: "unknown_code", contract_id: "toy2" }]);
  assert.ok(md.includes("Every element was supported by a fact cited from the submitted facts."));
  assert.ok(md.includes("A defence element was supported by a fact cited from the submitted facts."));
});

test("memo: a missing or undefined quote_source prints the cited text bare, never in quotation marks", () => {
  const md = memo([{ elements: [el({ element: "d", quote: "plain text", quote_source: undefined }) as never, (() => { const e = el({ element: "e", quote: "plain two" }) as Record<string, unknown>; delete e.quote_source; return e; })() as never] }]);
  assert.ok(md.includes("| d | supported by a fact | plain text (F1) |"), md);
  assert.ok(md.includes("| e | supported by a fact | plain two (F1) |"), md);
});
