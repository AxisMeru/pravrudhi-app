// The Screening view's mapping from an analyse-facts response to checklist rows and a matter summary, as pure functions (no React). The
// engine's decisions are not changed or second-guessed here: a row's chip is a plain-words reading of the element's own status. Nothing at row
// level says "proved" or "established".

import contractElements from "../fixtures/contractElements.json";
import whatToCheck from "../fixtures/whatToCheck.json";
import type { AnalyseFactsContract, AnalyseFactsElement, AnalyseFactsResult } from "../api";
import { citationKind, citationNote, type CitationKind } from "../citedFact";
import { elementStatusPresentation } from "../elementStatus";
import { QUOTE_CHECK_TEXT } from "../reasonText";
import { referReasonPresentation } from "../referReason";
import { ALL_SUPPORTED_TEXT, bannerText, type Chip } from "./copy";

/** The optional per-element screening signal (4B p; supported if >= its threshold). Absent on an engine that does not send it. */
export interface ScreeningSignal {
  p: number;
  supported: boolean;
}
export type ScreenedElement = AnalyseFactsElement & { screening_signal?: ScreeningSignal | null };

export interface ScreeningRow {
  contractId: string;
  element: string;
  isDefence: boolean;
  chip: Chip;
  /** True when the chip comes from the screening signal, not the judges' decision. */
  suggested: boolean;
  /** The plain-words reason for "Needs your review" (and for a not-supported row when the engine gives one); null otherwise. */
  reason: string | null;
  citation: CitationKind;
  /** The cited fact's id and its FULL text from the submitted facts, when the engine named one. */
  factId: string | null;
  factText: string | null;
  /** The engine's own citation_note, or the app's fallback sentence; null when no citation claim may be made. */
  note: string | null;
  /** A model quote (frontier path) with the quote-check sentence; never set for a whole-fact or unstated citation. */
  quote: { text: string; check: string | null } | null;
  whatToCheck: string | null;
}

export interface ScreeningSummary {
  total: number;
  supported: number;
  review: number;
  /** The headline sentence for the banner. */
  text: string;
  allSupported: boolean;
}

export const LEAN_PASS_OUTCOME = "PROOF";

export function whatToCheckFor(contractId: string, element: string): string | null {
  return (whatToCheck.checks as Record<string, string>)[`${contractId}|${element}`] ?? null;
}

export function knownElements(contractId: string): { elements: string[]; denials: string[] } | null {
  const c = (contractElements.contracts as Record<string, { elements: string[]; denials: string[] }>)[contractId];
  return c ?? null;
}

function chipFor(el: ScreenedElement, uncertain: boolean): { chip: Chip; suggested: boolean; reason: string | null } {
  const st = elementStatusPresentation(el.status);
  if (uncertain) return { chip: "review", suggested: false, reason: referReasonPresentation("uncertain").message };
  if (el.status === "established") return { chip: "supported", suggested: false, reason: null };
  const signal = el.screening_signal;
  if (signal && signal.supported === true) return { chip: "suggested", suggested: true, reason: null };
  if (el.status === "not_established") return { chip: "not_supported", suggested: false, reason: null };
  // not_confirmed, both not_evaluated cases and any status this build does not know: a review item with the signed sentence, never an error.
  return { chip: "review", suggested: false, reason: st.explanation ?? "The engine gave a status this app does not recognise yet; please check this ingredient." };
}

export function rowFor(contract: AnalyseFactsContract, el: ScreenedElement, facts: AnalyseFactsResult["facts"]): ScreeningRow {
  const uncertain = (contract.uncertain ?? []).includes(el.element);
  const { chip, suggested, reason } = chipFor(el, uncertain);
  const kind = citationKind(el);
  const fact = el.fact_id ? facts.find((f) => f.id === el.fact_id) ?? null : null;
  const cites = kind === "whole_fact" || kind === "unstated";
  return {
    contractId: contract.contract_id,
    element: el.element,
    isDefence: el.is_denial,
    chip,
    suggested,
    reason,
    citation: kind,
    factId: cites || kind === "model" ? el.fact_id : null,
    factText: cites && fact && fact.text ? fact.text : null,
    note: citationNote(el),
    quote: kind === "model" && el.quote ? { text: el.quote, check: el.quote_check && Object.prototype.hasOwnProperty.call(QUOTE_CHECK_TEXT, el.quote_check) ? QUOTE_CHECK_TEXT[el.quote_check] : null } : null,
    whatToCheck: whatToCheckFor(contract.contract_id, el.element),
  };
}

/** The rows of one contract: ingredients in the engine's order, then any defence that was found (never shown as an error, always a review item). */
export function rowsFor(contract: AnalyseFactsContract, facts: AnalyseFactsResult["facts"]): { ingredients: ScreeningRow[]; defences: ScreeningRow[] } {
  const all = (contract.elements ?? []).map((e) => rowFor(contract, e as ScreenedElement, facts));
  const defences = all.filter((r) => r.isDefence && r.chip !== "not_supported").map((r) => ({ ...r, chip: "review" as Chip }));
  return { ingredients: all.filter((r) => !r.isDefence), defences };
}

/**
 * The matter summary banner. The all-supported line needs EVERY ingredient supported by the judges (a suggestion from the screening signal does
 * not count), the engine's own PROOF outcome, the second judge having answered on every supported ingredient, the Lean structural check agreeing
 * (lean_outcome PROOF, the Lean checker's verdict "grounded"), and no defence found.
 */
export function summarize(contract: AnalyseFactsContract, rows: { ingredients: ScreeningRow[]; defences: ScreeningRow[] }): ScreeningSummary {
  const total = rows.ingredients.length;
  const supported = rows.ingredients.filter((r) => r.chip === "supported").length;
  // A suggestion from the screening signal names no cited fact: it is not in N, and it asks to be checked, so it is in K.
  const review = rows.ingredients.filter((r) => r.chip === "review" || r.chip === "suggested").length + rows.defences.length;
  const els = (contract.elements ?? []).filter((e) => !e.is_denial) as ScreenedElement[];
  const bothJudges = els.length > 0 && els.every((e) => e.status === "established" && typeof e.p_established_second === "number");
  const allSupported =
    total > 0 &&
    rows.ingredients.every((r) => r.chip === "supported" && !r.suggested) &&
    rows.defences.length === 0 &&
    contract.outcome === "PROOF" &&
    contract.lean_outcome === LEAN_PASS_OUTCOME &&
    bothJudges;
  return { total, supported, review, allSupported, text: allSupported ? ALL_SUPPORTED_TEXT : bannerText(supported, total, review) };
}

/** When the engine referred the whole contract to a lawyer: the signed reason sentence, shown under the banner; null otherwise. */
export function contractReferral(contract: AnalyseFactsContract): { message: string; code: string; twoJudgesOnly: boolean } | null {
  if (contract.outcome !== "REFER_TO_LAWYER") return null;
  const p = referReasonPresentation(contract.reason);
  return { message: p.message, code: contract.reason, twoJudgesOnly: p.twoJudgesOnly };
}
