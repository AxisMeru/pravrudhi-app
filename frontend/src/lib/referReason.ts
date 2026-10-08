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
// Each message is the signed sentence from the partner string table (the engine's docs/api/reason-codes.md) WORD FOR WORD: no
// lead-in, no lower-cased fragment, no paraphrase. The page and the memo show the heading "Referred to a lawyer" and then the
// sentence on its own. reasonStringsDrift.spec.ts compares every sentence with the signed table (fixtures/reasonCodesTable.json).
export const REFER_REASONS = [
  "denial_unquotable",
  "uncertain",
  "uncertain_second_judge",
  "second_judge_defeater_disagreement",
  "second_judge_unavailable",
  "gate1_unavailable",
  "gate1_not_entailed",
  "gate1_contradiction",
  "contract_not_validated",
  "input_too_long",
] as const;

export type ReferReason = (typeof REFER_REASONS)[number];

/** The heading every referral is shown under. The signed sentence follows it on its own line, with no lead-in. */
export const REFERRED_HEADING = "Referred to a lawyer";

/** The signed table marks some reasons with this parenthesis; it is shown beside the sentence, never inside it. */
export const TWO_JUDGES_ONLY_LABEL = "(deployments that use two judges only)";

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
    text: "The judge thinks a defeating fact exists but could not give a valid word-for-word quote for it. Please have a lawyer look.",
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
    text: "The second judge was unavailable, so we give a referral, not an answer.",
    twoJudgesOnly: true,
  },
  gate1_unavailable: {
    text: "The entailment check (a separate check of the quoted words against the claim) was unavailable, so we give a referral, not an answer.",
    twoJudgesOnly: false,
  },
  gate1_not_entailed: {
    text: "The entailment check (a separate check of the quoted words against the claim) did not find enough support for it. Please have a lawyer look.",
    twoJudgesOnly: false,
  },
  gate1_contradiction: {
    text: "The entailment check (a separate check of the quoted words against the claim) found they contradict it. Please have a lawyer look.",
    twoJudgesOnly: false,
  },
  contract_not_validated: {
    text: "This provision is not on the validated list, so we give a referral, not a proof or denial.",
    twoJudgesOnly: false,
  },
  input_too_long: {
    text: "The facts and question together are too long for the checker to read in one go, so we give a referral, not an answer. Please shorten them or have a lawyer look.",
    twoJudgesOnly: false,
  },
};

// `reason` is typed `string` because that is what AnalyseFactsContract carries off the wire -- the engine is
// a separate release train and may send a reason this build predates. Never hidden or reinterpreted: an
// unrecognised reason still names itself in the message (never silently substitutes a generic sentence with
// no trace of what the engine actually said), and the raw code is always shown alongside the message by the
// caller regardless of which branch below produced it. There is no signed wording for an unrecognised code.
export function referReasonPresentation(reason: string | null | undefined): ReferReasonPresentation {
  const raw = (reason ?? "").trim();
  if (!isReferReason(raw)) {
    return {
      reason: null,
      message: raw
        ? `The engine's reason, "${raw}", is not one this app recognises yet.`
        : "The engine gave no reason.",
      twoJudgesOnly: false,
      unknown: true,
    };
  }
  const { text, twoJudgesOnly } = REFER_REASON_TEXT[raw];
  return { reason: raw, message: text, twoJudgesOnly, unknown: false };
}
