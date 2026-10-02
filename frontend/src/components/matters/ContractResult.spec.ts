import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AnalyseFactsContract, AnalyseFactsElement } from "@/lib/api";
import { ContractResult } from "./ContractResult";

const facts = [{ id: "F1", text: "The cheque was dishonoured on 3 May." }];

function el(over: Partial<AnalyseFactsElement>): AnalyseFactsElement {
  return {
    element: "dishonour", is_denial: false, status: "established", p_established: 0.93, fact_id: "F1", quote: "dishonoured",
    start: 15, end: 26, quote_check: "ok", attempts: 1, occurrences: 1, offsets_source: "system", quote_source: "model", error: null,
    claimed: true,
    ...over,
  } as AnalyseFactsElement;
}

function contract(over: Partial<AnalyseFactsContract>): AnalyseFactsContract {
  return {
    contract_id: "ni138", outcome: "PROOF", reason: "all elements established", elements: [el({}), el({ element: "notice", quote: null, start: null, end: null, fact_id: null, status: "not_confirmed", p_established: 0.31 })],
    assertions: null, lean: { verdict: "ok", denied_claims: [], unlicensed_claims: [], omitted_claims: [] }, lean_outcome: "PROOF",
    lean_attestation: { binary_sha256: "a".repeat(64), wire_sha256: "b".repeat(64), verdict: "ok" },
    citations: [
      { act: "NI Act", section: "138", corpus_id: "c1", in_corpus: true, title: "Dishonour of cheque" },
      { act: "Ghost Act", section: "9", corpus_id: null, in_corpus: false, title: null },
    ],
    uncertain: [], statute_text_mismatch: null, ...over,
  };
}

const render = (c: AnalyseFactsContract, cov: Map<string, boolean> | null) =>
  renderToStaticMarkup(createElement(ContractResult, { c, facts, coverage: cov }));

test("each element shows status, p and the quote highlighted at its offsets", () => {
  const html = render(contract({}), new Map([["ni138", true]]));
  assert.match(html, /established/);
  assert.match(html, /p=0\.93/);
  assert.match(html, /The cheque was <mark[^>]*>dishonoured<\/mark> on 3 May\./);
  assert.match(html, /data-testid="validated-badge"/);
});

test("an element with no quote gets an explicit cell", () => {
  assert.match(render(contract({}), null), /no supporting quote/);
});

test("lean attestation and citations render, with the unresolved citation marked", () => {
  const html = render(contract({}), null);
  assert.match(html, /data-testid="lean-attestation"/);
  assert.match(html, /aaaaaaaaaaaa/);
  assert.match(html, /Dishonour of cheque/);
  assert.match(html, /data-testid="citation-unresolved"[^>]*>Ghost Act s\. 9/);
  assert.match(html, /not found in corpus/);
});

test("an engine without attestation or citations renders no such blocks", () => {
  const html = render(contract({ lean_attestation: undefined, citations: undefined }), null);
  assert.doesNotMatch(html, /lean-attestation|data-testid="citations"/);
});

test("an unvalidated contract is shown as not yet covered", () => {
  const html = render(contract({ outcome: "ABSTAIN" }), new Map([["ni138", false]]));
  assert.match(html, /not yet covered/);
  assert.doesNotMatch(html, /<table/);
});

test("no copy claims verification or Lean proof", () => {
  const html = render(contract({}), new Map([["ni138", true]]));
  assert.doesNotMatch(html, /verified|proven in Lean/i);
});
