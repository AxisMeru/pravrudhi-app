// How a REFER_TO_LAWYER outcome's `reason` code is presented, as a pure function of the reason string the
// engine sent -- no React here, mirroring elementStatus.ts's own seam (same exhaustive-switch-with-a-never-
// arm shape, same reasons for it).
//
// R1's finding (2026-09-27, reviewing the MVP demo screenshots): the matters page showed the SAME banner --
// "the judge could not reach a confident established/not-established reading on every element" -- for every
// REFER_TO_LAWYER, including `second_judge_unavailable` and `contract_not_validated`, neither of which is
// uncertainty at all. That is misleading in the same shape #37 already fixed for element statuses: a reader
// cannot tell "the model wasn't sure" from "we couldn't reach a second opinion" from "this provision isn't
// cleared yet" -- three very different situations that call for three different reactions from a reader.
//
// The engine's own nyaya_agent.py (`_run_contract`) currently produces NINE distinct REFER_TO_LAWYER
// reasons, not the three R1's own report named -- mapping only some and letting the rest fall into the
// generic "unknown reason" fallback would just be a smaller version of the same bug this file exists to
// fix, so all nine known reasons get their own message below. (This file was written when the engine had eight;
// `second_judge_defeater_disagreement` was missed, so a split on a defeater read as "not one this app
// recognises yet". src/lib/fixtures/engineContractReasons.json is the engine's own list, copied with its source,
// and referReason.spec.ts holds this list equal to it.)
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
] as const;

export type ReferReason = (typeof REFER_REASONS)[number];

export interface ReferReasonPresentation {
  // The canonical reason this presentation came from, or null when the engine sent something this build does
  // not know. Callers that need to branch on "we could not read this" check `reason === null` or `unknown`.
  reason: ReferReason | null;
  message: string;
  unknown: boolean;
}

export function isReferReason(reason: string): reason is ReferReason {
  return (REFER_REASONS as readonly string[]).includes(reason);
}

// Adding a further reason to ReferReason without giving it a message is a COMPILE error here: the default arm
// narrows to `never`, and a value of the new reason no longer assigns to it -- same device elementStatus.ts
// uses for exactly the same purpose.
function unhandledReason(reason: never): never {
  throw new Error(`referReasonPresentation: unhandled REFER_TO_LAWYER reason ${JSON.stringify(reason)}`);
}

// `reason` is typed `string` because that is what AnalyseFactsContract carries off the wire -- the engine is
// a separate release train and may send a reason this build predates. Never hidden or reinterpreted: an
// unrecognised reason still names itself in the message (never silently substitutes a generic sentence with
// no trace of what the engine actually said), and the raw code is always shown alongside the message by the
// caller regardless of which branch below produced it.
export function referReasonPresentation(reason: string | null | undefined): ReferReasonPresentation {
  const raw = (reason ?? "").trim();
  if (!isReferReason(raw)) {
    return {
      reason: null,
      message: raw
        ? `this matter needs a lawyer's review (the engine's reason, "${raw}", is not one this app recognises yet)`
        : "this matter needs a lawyer's review (the engine gave no reason)",
      unknown: true,
    };
  }

  switch (raw) {
    case "uncertain":
      // The primary judge's own p_established landed in the refer band on at least one element -- genuine
      // model uncertainty, the only one of the nine reasons the OLD banner text was ever actually true for.
      return { reason: raw, message: "an element couldn't be judged confidently from these facts", unknown: false };
    case "uncertain_second_judge":
      // Config C only: the second judge answered, but its own logit-distance band fired -- a second opinion
      // was reached, and it wasn't confident either. Distinct from `second_judge_unavailable`, where no
      // second opinion was reached AT ALL.
      return {
        reason: raw,
        message: "the second check couldn't confirm this confidently from these facts",
        unknown: false,
      };
    case "second_judge_defeater_disagreement":
      // Config C only: a defeater (a fact that would defeat the claim) was judged by both judges and they split. The
      // contract is referred, never proved: an unresolved defeater cannot be waved through.
      return {
        reason: raw,
        message:
          "the first and second judges disagree on whether a fact defeats this claim, so we refer it to a lawyer",
        unknown: false,
      };
    case "second_judge_unavailable":
      return {
        reason: raw,
        message: "the second check was temporarily unavailable, so we didn't give a verdict — please try again",
        unknown: false,
      };
    case "denial_unquotable":
      // The judge leaned toward a defence (e.g. good faith) but couldn't back it with a verbatim quote from
      // the facts -- a possible finding the app declines to assert without the evidence to show for it.
      return {
        reason: raw,
        message:
          "a possible defence was suggested but couldn't be confirmed with a matching quote from the facts",
        unknown: false,
      };
    case "gate1_unavailable":
      // Gate 1 (the entailment check) errored before the judges were ever asked -- nothing was concluded,
      // same shape as second_judge_unavailable but at the earlier gate.
      return {
        reason: raw,
        message: "the entailment check was temporarily unavailable, so we didn't give a verdict — please try again",
        unknown: false,
      };
    case "gate1_not_entailed":
      return {
        reason: raw,
        message: "the facts as given didn't clearly support this element's reading of the law",
        unknown: false,
      };
    case "gate1_contradiction":
      return {
        reason: raw,
        message: "the facts appear to contradict this element's own terms",
        unknown: false,
      };
    case "contract_not_validated":
      return { reason: raw, message: "this provision isn't yet cleared for automatic decisions", unknown: false };
    default:
      return unhandledReason(raw);
  }
}
