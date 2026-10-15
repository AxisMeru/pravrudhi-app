// Hearing preparation (pravrudhi-app#197): a pure, deterministic function from the engine's screening result (the JSON the app already
// receives) to a checklist. It adds nothing: no fact and no law. Each open ingredient carries its own "What to check" text, each block
// its screen title, and the citations are the ones the screening (a contract's provisions) or intake (found in the pasted text) gave.
// No contract id, reason code or engine status leaves this module: the output is display text only (hearingPrep.spec.ts scans it).
import type { AnalyseFactsResult } from "../api";
import { BANNER_STANDING_LINE, NO_CHECK_NOTE, WHAT_TO_CHECK_LABEL } from "./copy";
import { contractReferral, rowsFor, summarize } from "./model";
import { memoBlockHeading } from "./memo";
import { isAlternateLimb } from "./offences";

/** The words this module owns, in ONE table so R1 words them once and the spec pins them exactly (PROPOSED wording, 15 Oct: R1 signs at the head). */
export const HEARING_PREP_STRINGS = {
  heading: "Hearing preparation",
  openHeading: "Ingredients still open",
  noneOpen: "Every ingredient under this heading has a fact cited by the screening.",
  citationsHeading: "Citations to check",
  noCitations: "No citations to check were found.",
  citationFromScreening: "Provision the screening applied",
  citationFromIntake: "Found in the text you pasted",
  allSupportedNote: "Nothing is open under any heading. This checklist is a screening aid: read the cited facts yourself before you rely on them.",
  // R1's exact words (15 Oct, #215): a block the screening did not settle gets this sentence INSTEAD of a checklist; nothing screened gets the second.
  unsettledBlock: "The screening did not settle this part, so no checklist is given here. A lawyer should read the result for it.",
  nothingScreened: "Nothing was screened, so there is no checklist to prepare.",
  checkLabel: WHAT_TO_CHECK_LABEL,
  standingLine: BANNER_STANDING_LINE,
} as const;

/** An ingredient the judges did not support (not supported, needs review, or only suggested by the screening signal), with its own existing "What to check" text. */
export interface OpenIngredient {
  /** The ingredient as the screen words it. */
  ingredient: string;
  /** The ingredient's existing "What to check" text; the screen's own "not screened yet" sentence when the app has none for it. Never new wording. */
  whatToCheck: string;
}

/**
 * open: it has ingredients, the engine did not refer it, and at least one ingredient is not supported (the checklist is given).
 * settled: the screen's own all-supported line holds for it (model.ts summarize().allSupported: the ONE predicate, imported, not copied).
 * unsettled: referred to a lawyer, no ingredient rows, or all ingredients supported but the screen withholds its all-supported line (ABSTAIN, Lean disagreement, a missing second-judge p): no checklist, `open` is empty and the app shows unsettledBlock.
 */
export type BlockState = "open" | "settled" | "unsettled";

export interface HearingPrepBlock {
  /** Position in the result (1-based): a stable list key. Never a contract id. */
  index: number;
  /** The block title shown on the screen and in the memo. */
  title: string;
  /** True for the second or later way of an offence that has a title of its own, as on the screen (the app adds its signed alternate-way note). */
  alternateWay: boolean;
  open: OpenIngredient[];
  state: BlockState;
}

export type CitationSource = "screening" | "intake";
export interface HearingPrepCitation {
  /** The citation as found: a provision (act and section) from the screening, or the text from intake. */
  text: string;
  source: CitationSource;
}

/** nothingScreened: the result has no blocks. open: some block has an open ingredient. unsettled: none is open but some block is unsettled. settled: at least one block and every block settled. */
export type HearingPrepStatus = "nothingScreened" | "open" | "unsettled" | "settled";

export interface HearingPrep {
  blocks: HearingPrepBlock[];
  citations: HearingPrepCitation[];
  status: HearingPrepStatus;
  /** True ONLY for status "settled": an empty list of blocks or a referred block never reads as nothing open. */
  nothingOpen: boolean;
}

/** The citation text intake found, as the app parses it (intake.ts IntakeCitation); nothing else is read from intake. */
export interface IntakeCitationInput {
  text: string;
}

const provisionText = (c: { act?: unknown; section?: unknown }): string | null => {
  const act = typeof c.act === "string" ? c.act.trim() : "";
  if (!act) return null;
  const section = typeof c.section === "string" ? c.section.trim() : "";
  return section ? `${act}, section ${section}` : act;
};

/**
 * Builds the checklist. Blocks keep the engine's order; an ingredient is open unless its chip is "supported"; facts that may defeat the claim
 * are not part of this checklist. Citations: each contract's provisions (deduplicated), then the citations intake found (deduplicated, in order).
 */
export function buildHearingPrep(result: AnalyseFactsResult, intakeCitations: readonly IntakeCitationInput[] = []): HearingPrep {
  const blocks: HearingPrepBlock[] = [];
  const citations: HearingPrepCitation[] = [];
  const seen = new Set<string>();
  const add = (text: string, source: CitationSource): void => {
    const key = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      citations.push({ text: text.replace(/\s+/g, " ").trim(), source });
    }
  };
  (result.contracts ?? []).forEach((c, i) => {
    const all = rowsFor(c, result.facts ?? []);
    const rows = all.ingredients;
    const open = rows.filter((r) => r.chip !== "supported").map((r) => ({ ingredient: r.element, whatToCheck: r.whatToCheck ?? NO_CHECK_NOTE }));
    const state: BlockState =
      contractReferral(c) !== null || rows.length === 0 ? "unsettled" : open.length > 0 ? "open" : summarize(c, all).allSupported ? "settled" : "unsettled";
    blocks.push({ index: i + 1, title: memoBlockHeading(c.contract_id), alternateWay: isAlternateLimb(c.contract_id), open: state === "open" ? open : [], state });
    for (const p of c.citations ?? []) {
      const t = provisionText(p);
      if (t) add(t, "screening");
    }
  });
  for (const ic of intakeCitations) if (typeof ic?.text === "string") add(ic.text, "intake");
  const status: HearingPrepStatus =
    blocks.length === 0 ? "nothingScreened" : blocks.some((b) => b.state === "open") ? "open" : blocks.some((b) => b.state === "unsettled") ? "unsettled" : "settled";
  return { blocks, citations, status, nothingOpen: status === "settled" };
}
