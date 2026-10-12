// The content assertions of the scripted demo E2E (#18): what a real analyse-facts response must contain for a demo fixture,
// as a pure function so the checks themselves are unit-tested (including planted failures) against recorded or synthetic
// results, and the live Playwright spec only has to fetch a real response and call them. A violation is a plain string.

import { createHash } from "node:crypto";

import type { AnalyseFactsContract, AnalyseFactsResult, AnalyseFactsWire } from "../api";
import { nonReferReasonText } from "../reasonText";
import { referReasonPresentation } from "../referReason";

export const OUTCOMES = ["PROOF", "DENIAL", "ABSTAIN", "REFER_TO_LAWYER"] as const;
const SHA256 = /^[0-9a-f]{64}$/;
const UNCOVERED_REASON = "no_training_statute_text";

export interface DemoFixture {
  id: string;
  label: string;
  path: "proof" | "abstain" | "refer";
  contract_ids: string[];
  wordings: { plain: string[]; formal: string[] };
  expect: { recorded_runs: number; outcomes: Record<string, string> | null };
}

/** The recorded expectation binds only once a fixture has been run at least 3 times in one window and recorded. */
export function expectationBinds(f: DemoFixture): boolean {
  return f.expect.outcomes !== null && f.expect.recorded_runs >= 3;
}

function checkContract(c: AnalyseFactsContract, submitted: string[], factIds: Set<string>, out: string[]): void {
  const id = c.contract_id;
  if (!(OUTCOMES as readonly string[]).includes(c.outcome)) out.push(`${id}: outcome "${c.outcome}" is not one of ${OUTCOMES.join("/")}`);
  if (c.reason !== undefined && c.reason !== null && typeof c.reason !== "string") out.push(`${id}: reason is not a string`);
  const uncovered = c.outcome === "ABSTAIN" && (c.reason ?? "").includes(UNCOVERED_REASON);
  if (!uncovered) {
    if (!Array.isArray(c.citations)) out.push(`${id}: no citations array (the contract's provisions)`);
    else if (c.citations.length === 0) out.push(`${id}: citations is empty`);
  }
  if (c.outcome === "PROOF" || c.outcome === "DENIAL") {
    if (!Array.isArray(c.elements) || c.elements.length === 0) out.push(`${id}: ${c.outcome} with no element rows`);
    if (c.outcome === "PROOF" && (c.elements ?? []).every((e) => e.status !== "established")) out.push(`${id}: PROOF with no established element`);
  }
  for (const e of c.elements ?? []) {
    if (e.status !== "established") continue;
    // The claim branches on how the engine cited the element (#812, #813). Only a model quote is held to a word-for-word check; a whole-fact citation
    // (the house judges) is held to naming a fact that was submitted, with NO claim about quoted words; anything else makes no claim.
    if (e.quote_source === "model") {
      if (!e.quote) out.push(`${id}/${e.element}: a model-cited element has no quote`);
      else if (!submitted.some((f) => f.includes(e.quote as string))) out.push(`${id}/${e.element}: the model quote is not verbatim in the submitted facts`);
    } else if (e.quote_source === "whole_fact") {
      if (!e.fact_id || !factIds.has(e.fact_id)) out.push(`${id}/${e.element}: the cited fact "${e.fact_id ?? ""}" is not one of the submitted facts`);
    }
    if (e.citation_note !== undefined && e.citation_note !== null && (typeof e.citation_note !== "string" || !e.citation_note.trim())) {
      out.push(`${id}/${e.element}: citation_note is present but empty`);
    }
  }
  if (c.outcome === "REFER_TO_LAWYER") {
    if (!c.reason) out.push(`${id}: REFER_TO_LAWYER with no reason`);
    else if (referReasonPresentation(c.reason).unknown) out.push(`${id}: REFER reason "${c.reason}" is not one this app knows`);
  }
  if (c.outcome === "ABSTAIN" && c.reason && !uncovered && nonReferReasonText(c.reason) === null) {
    out.push(`${id}: ABSTAIN reason "${c.reason}" is not one this app knows`);
  }
}

/** Violations of a real response for one fixture run. An empty list is a pass. */
export function checkDemoResult(result: AnalyseFactsWire, submitted: string[], fixture: DemoFixture): string[] {
  const out: string[] = [];
  if (!result || typeof result !== "object") return ["no result"];
  if (!result.run_id) out.push("no run id");
  if (!SHA256.test(result.score_sha256 ?? "")) out.push("score sha256 is not 64 hex characters");
  if (!Array.isArray(result.facts) || result.facts.length !== submitted.length) {
    out.push(`the engine echoed ${Array.isArray(result.facts) ? result.facts.length : "no"} facts for ${submitted.length} submitted`);
  } else {
    result.facts.forEach((f, i) => {
      // The engine echoes each fact as {id, sha256} and no text, so the echo is checked by hash of the (stripped) submitted fact. A text, if a
      // later engine sends one, must also be the submitted text.
      if (!SHA256.test(f.sha256 ?? "")) out.push(`fact ${i + 1} has no 64-hex sha256`);
      else if (f.sha256 !== createHash("sha256").update(submitted[i].trim()).digest("hex")) out.push(`fact ${i + 1} was not echoed word for word (sha256 differs)`);
      const text = (f as { text?: unknown }).text;
      if (text !== undefined && text !== submitted[i].trim()) out.push(`fact ${i + 1} echoed text differs from the submitted text`);
    });
  }
  if (!result.retention_notice) out.push("no retention notice in the response");
  const factIds = new Set((result.facts ?? []).map((f) => f.id));
  const byId = new Map<string, AnalyseFactsContract[]>();
  for (const c of result.contracts ?? []) byId.set(c.contract_id, [...(byId.get(c.contract_id) ?? []), c]);
  for (const want of fixture.contract_ids) {
    const got = byId.get(want) ?? [];
    if (got.length !== 1) out.push(`${want}: ${got.length} result cards, expected exactly 1`);
    else checkContract(got[0], submitted, factIds, out);
  }
  for (const id of byId.keys()) if (!fixture.contract_ids.includes(id)) out.push(`${id}: a contract that was not requested`);
  if (expectationBinds(fixture)) {
    for (const [id, outcome] of Object.entries(fixture.expect.outcomes ?? {})) {
      const got = byId.get(id)?.[0]?.outcome;
      if (got !== outcome) out.push(`${id}: outcome ${got ?? "missing"} differs from the recorded ${outcome}`);
    }
  }
  return out;
}

/** Violations of the downloaded memo against the result it was built from. */
export function checkMemoText(memo: string, result: AnalyseFactsResult): string[] {
  const out: string[] = [];
  if (!memo.includes(result.run_id)) out.push("the memo does not carry the run id");
  if (!memo.includes(result.score_sha256)) out.push("the memo does not carry the score sha256");
  for (const c of result.contracts) {
    if (!memo.includes(`## ${c.contract_id}`)) out.push(`the memo has no section for ${c.contract_id}`);
    if (!memo.includes(`Outcome: ${c.outcome}`)) out.push(`the memo does not state ${c.contract_id}'s outcome`);
    for (const e of c.elements ?? []) {
      if (e.quote_source === "model" && e.quote && !memo.includes(e.quote.replace(/\r?\n/g, " ").replace(/\|/g, "\\|"))) out.push(`${c.contract_id}/${e.element}: the model quote is missing from the memo`);
      if (e.quote_source === "whole_fact" && e.fact_id && !memo.includes(e.fact_id)) out.push(`${c.contract_id}/${e.element}: the cited fact id is missing from the memo`);
    }
  }
  return out;
}
