// Hearing preparation (pravrudhi-app#197): a pure, deterministic function from the engine's screening result (the JSON the app already
// receives) to a checklist. It adds nothing: no fact and no law. Each open ingredient carries its own "What to check" text, each block
// its screen title, and the citations are the ones the screening (a contract's provisions) or intake (found in the pasted text) gave.
// No contract id, reason code or engine status leaves this module: the output is display text only (hearingPrep.spec.ts scans it).
import type { AnalyseFactsResult } from "../api";
import { BANNER_STANDING_LINE, NO_CHECK_NOTE, WHAT_TO_CHECK_LABEL } from "./copy";
import { rowsFor } from "./model";
import { memoBlockHeading } from "./memo";
import { isAlternateLimb } from "./offences";

/** The words this module owns, in ONE table so R1 words them once and the spec pins them exactly (PROPOSED wording, 15 Oct: R1 signs at the head). */
export const HEARING_PREP_STRINGS = {
  heading: "Hearing preparation",
  openHeading: "Ingredients still open",
  noneOpen: "Every ingredient in this block is supported by a fact the screening found.",
  citationsHeading: "Citations to check",
  noCitations: "The screening and intake found no citations to check.",
  citationFromScreening: "Provision the screening applied",
  citationFromIntake: "Found in the text you pasted",
  allSupportedNote: "Nothing is open in any block. This checklist is a screening aid: read the supported facts yourself before you rely on them.",
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

export interface HearingPrepBlock {
  /** Position in the result (1-based): a stable list key. Never a contract id. */
  index: number;
  /** The block title shown on the screen and in the memo. */
  title: string;
  /** True for the second or later way of an offence that has a title of its own, as on the screen (the app adds its signed alternate-way note). */
  alternateWay: boolean;
  open: OpenIngredient[];
}

export type CitationSource = "screening" | "intake";
export interface HearingPrepCitation {
  /** The citation as found: a provision (act and section) from the screening, or the text from intake. */
  text: string;
  source: CitationSource;
}

export interface HearingPrep {
  blocks: HearingPrepBlock[];
  citations: HearingPrepCitation[];
  /** True when no block has an open ingredient. */
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
    const open = rowsFor(c, result.facts ?? []).ingredients
      .filter((r) => r.chip !== "supported")
      .map((r) => ({ ingredient: r.element, whatToCheck: r.whatToCheck ?? NO_CHECK_NOTE }));
    blocks.push({ index: i + 1, title: memoBlockHeading(c.contract_id), alternateWay: isAlternateLimb(c.contract_id), open });
    for (const p of c.citations ?? []) {
      const t = provisionText(p);
      if (t) add(t, "screening");
    }
  });
  for (const ic of intakeCitations) if (typeof ic?.text === "string") add(ic.text, "intake");
  return { blocks, citations, nothingOpen: blocks.every((b) => b.open.length === 0) };
}
