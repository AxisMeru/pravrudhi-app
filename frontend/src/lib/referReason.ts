// How a REFER_TO_LAWYER outcome's `reason` code is presented, as a pure function of the reason string the
// engine sent -- no React here, mirroring elementStatus.ts's own seam (same exhaustive-switch-with-a-never-
// arm shape, same reasons for it).
//
// R1's finding (2026-09-27, reviewing the MVP demo screenshots): the matters page showed the SAME banner --
// "the judge could not reach a confident established/not-established reading on every element" -- for every
// REFER_TO_LAWYER, including `second_judge_unavailable` and `contract_not_validated`, neither of which is
// uncertainty at all. That is misleading in the same shape #37 already fixed for element statuses: a reader
// cannot tell "the model wasn't sure" from "we couldn't reach a second opinion" from "this provision isn't
// on the validated list yet" -- three very different situations that call for three different reactions from a reader.
//
// The engine's own nyaya_agent.py (`_run_contract`) currently produces NINE distinct REFER_TO_LAWYER
// reasons, not the three R1's own report named -- mapping only some and letting the rest fall into the
// generic "unknown reason" fallback would just be a smaller version of the same bug this file exists to
// fix, so all nine known reasons get their own message below. (This file was written when the engine had eight;
// `second_judge_defeater_disagreement` was missed, so a split on a defeater read as "not one this app
// recognises yet". src/lib/fixtures/engineContractReasons.json is the engine's own list, copied with its source,
// and referReason.spec.ts holds this list equal to it.)
//
// R1 (14 Oct): the app words below differ on purpose from the engine's table for the reasons in APP_FORM (reasonStringsDrift.spec.ts); the rest are the signed sentence from the partner string table (the engine's docs/api/reason-codes.md) WORD FOR WORD: no
// lead-in, no lower-cased fragment, no paraphrase. The page and the memo show the heading "Referred to a lawyer" and then the
// sentence on its own. reasonStringsDrift.spec.ts compares every sentence with the signed table (fixtures/reasonCodesTable.json).
export const REFER_REASONS = [
  "denial_unquotable",
  "uncertain",
  "uncertain_second_judge",
  "second_judge_defeater_disagreement",
  "second_judge_unavailable",
  "second_judge_not_confirmed",
  "gate1_unavailable",
  "gate1_not_entailed",
  "gate1_contradiction",
  "contract_not_validated",
  "input_too_long",
] as const;

export type ReferReason = (typeof REFER_REASONS)[number];

/** The heading every referral is shown under. The signed sentence follows it on its own line, with no lead-in. */
/** R1 (14 Oct): the one sentence for a reason this build does not know, on every result screen; no engine word, no code. */
export const UNKNOWN_REASON_TEXT = "This ingredient needs a lawyer's look. The screening has no further detail for it.";

export const REFERRED_HEADING = "For a lawyer to review";


export interface ReferReasonPresentation {
  // The canonical reason this presentation came from, or null when the engine sent something this build does
  // not know. Callers that need to branch on "we could not read this" check `reason === null` or `unknown`.
  reason: ReferReason | null;
  /** The signed sentence for the reason, verbatim; for an unknown code, a sentence naming it. */
  message: string;
  /** True for the reasons the signed table marks "deployments that use two judges only"; shown as a small label OUTSIDE the sentence. */
  twoJudgesOnly: boolean;
  unknown: boolean;
}

export function isReferReason(reason: string): reason is ReferReason {
  return (REFER_REASONS as readonly string[]).includes(reason);
}

/** The signed sentences (docs/api/reason-codes.md), one per REFER reason, word for word. */
export const REFER_REASON_TEXT: Readonly<Record<ReferReason, { text: string; twoJudgesOnly: boolean }>> = {
  denial_unquotable: {
    text: "The judge thinks a defeating fact exists but could not cite it in a way we can check. Please have a lawyer look.",
    twoJudgesOnly: false,
  },
  second_judge_defeater_disagreement: {
    text: "The two judges disagree on whether a defeating fact exists. Please have a lawyer look.",
    twoJudgesOnly: true,
  },
  uncertain: {
    text: "The judge is not sure whether a condition holds. Please have a lawyer look.",
    twoJudgesOnly: false,
  },
  uncertain_second_judge: {
    text: "The second judge is not sure whether a condition holds. Please have a lawyer look.",
    twoJudgesOnly: true,
  },
  second_judge_unavailable: {
    text: "A second check was unavailable, so we hand this ingredient back to you.",
    twoJudgesOnly: true,
  },
  second_judge_not_confirmed: {
    text: "One check found support for this ingredient in your facts, but a second check did not confirm it. A lawyer should look.",
    twoJudgesOnly: true,
  },
  gate1_unavailable: {
    text: "A check of the cited fact was unavailable, so we hand this ingredient back to you.",
    twoJudgesOnly: false,
  },
  gate1_not_entailed: {
    text: "The entailment check (a separate check of the cited fact against the claim) did not find enough support for it. Please have a lawyer look.",
    twoJudgesOnly: false,
  },
  gate1_contradiction: {
    text: "The entailment check (a separate check of the cited fact against the claim) found the fact contradicts it. Please have a lawyer look.",
    twoJudgesOnly: false,
  },
  contract_not_validated: {
    text: "This offence is not on our validated list, so the screening hands it back to you instead of giving a result.",
    twoJudgesOnly: false,
  },
  input_too_long: {
    text: "The facts are too long for the screening to read in one go, so it hands this back to you. Please shorten them or ask a lawyer to review.",
    twoJudgesOnly: false,
  },
};

// `reason` is typed `string` because that is what AnalyseFactsContract carries off the wire -- the engine is
// a separate release train and may send a reason this build predates. An unrecognised reason is shown as R1's generic
// sentence (14 Oct), with no raw code inside it; no result screen shows the raw code (the memo keeps its labelled engine-code line).
export function referReasonPresentation(reason: string | null | undefined): ReferReasonPresentation {
  const raw = (reason ?? "").trim();
  if (!isReferReason(raw)) {
    return {
      reason: null,
      message: raw
        ? UNKNOWN_REASON_TEXT
        : "No further detail is available for this ingredient.",
      twoJudgesOnly: false,
      unknown: true,
    };
  }
  const { text, twoJudgesOnly } = REFER_REASON_TEXT[raw];
  return { reason: raw, message: text, twoJudgesOnly, unknown: false };
}
