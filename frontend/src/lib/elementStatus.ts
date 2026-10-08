// How one element's status is presented, as a pure function of the status string the engine sent — no React
// here, so it can be tested directly and reused by any surface that shows an element (the matters page today,
// the audit views next).
//
// The engine produces FIVE element statuses (AxisMeru/pravrudhi#37, PR #45; the fifth decided by the
// operator 2026-09-26), not two:
//
//   established                        every configured judge cleared its tau.
//   not_confirmed                      the judges lean established (primary p >= 0.5, and the second p >= 0.5
//                                      or not asked) but the served tau was not cleared. Issue #37 is explicit
//                                      that this is shown as "not confirmed at the required confidence" and
//                                      NEVER as a failure — on constructed v1 about 37% of genuinely
//                                      gold-established elements land here.
//   not_established                    a judge actually scored the element unmet (p < 0.5 on the vetoing judge).
//   not_evaluated_second_unavailable   the second judge did not answer at all, so nothing was concluded either
//                                      way. This is the original #37 case: it must never read as a verdict.
//   not_evaluated_gate1_unavailable    Gate 1 (the entailment check) could not run, so the element was never
//                                      taken to the judges at all. Distinct from the second-judge case: there
//                                      nothing CONCLUDED, here nothing was even CHECKED. Also never a verdict.
//                                      Nothing emits it yet — Gate 1 is off by default in production
//                                      (`gate1_enabled`), which is what makes this app-side change safe to
//                                      land before the engine starts sending the value.
//
// The collapse this replaces treated `el.status === "established"` as the whole question, so all three
// non-established values — AND any status this build has never heard of — rendered the definite negative
// "not established". That failed OPEN: an unrecognised status became a finding against the matter. Here an
// unrecognised or empty status fails CLOSED, to an explicit unknown presentation that asserts no finding.

// The canonical list, in the order the engine documents them. Exported so tests (and any future picker) can
// walk the statuses without keeping a second copy of the list.
export const ELEMENT_STATUSES = [
  "established",
  "not_confirmed",
  "not_established",
  "not_evaluated_second_unavailable",
  "not_evaluated_gate1_unavailable",
] as const;

export type ElementStatus = (typeof ELEMENT_STATUSES)[number];

// Which finding a presentation asserts. `null` means "no finding either way" — used for not_confirmed (the
// judges leaned established but the bar was not met), for both not-evaluated cases, and for an
// unrecognised status. Only `established` and `not_established` are verdicts.
export type ElementVerdict = "established" | "not_established";

import { ELEMENT_STATUS_EXPLANATION } from "./signedStrings";

export interface ElementStatusPresentation {
  // The canonical status this presentation came from, or null when the engine sent something this build does
  // not know. Callers that need to branch on "we could not read this" check `status === null` or `unknown`.
  status: ElementStatus | null;
  label: string;
  // Tailwind utility classes for the badge, in the same shape as the page's own OUTCOME tones. Distinct per
  // status: not_confirmed, not_established and the two not-evaluated cases must never look alike.
  tone: string;
  verdict: ElementVerdict | null;
  /** The signed sentence for what this status means; null for an unrecognised status (no signed wording for it). */
  explanation: string | null;
  unknown: boolean;
}

// Kept beside the labels so the "fails closed" path is one object rather than a shape assembled at the call
// site. Dim, dashed and plainly not a verdict — it says the status could not be read, not that the element
// was found absent.
const UNKNOWN_PRESENTATION: ElementStatusPresentation = {
  status: null,
  label: "status not recognised",
  tone: "text-[var(--color-text-dim)] border-dashed border-[var(--color-border)]",
  verdict: null,
  explanation: null,
  unknown: true,
};

export function isElementStatus(status: string): status is ElementStatus {
  return (ELEMENT_STATUSES as readonly string[]).includes(status);
}

// Adding a further status to ElementStatus without giving it a presentation is a COMPILE error here: the default
// arm narrows to `never`, and a value of the new status no longer assigns to it.
function unhandledStatus(status: never): never {
  throw new Error(`elementStatusPresentation: unhandled element status ${JSON.stringify(status)}`);
}

// `status` is typed `string` because that is what AnalyseFactsElement carries off the wire — the engine is a
// separate release train and may send a status this build predates. Anything outside the five canonical values
// (including "" and whitespace) returns UNKNOWN_PRESENTATION rather than throwing: this runs inside the render
// of a response that has already arrived, and an exception there would blank a page of real results over one
// unreadable field. Callers that want to treat it as an error have `unknown`/`status === null` to check.
export function elementStatusPresentation(
  status: string | null | undefined,
): ElementStatusPresentation {
  const raw = (status ?? "").trim();
  if (!isElementStatus(raw)) return UNKNOWN_PRESENTATION;

  switch (raw) {
    case "established":
      // Unchanged from the pre-extraction page, deliberately: the established case must look exactly as it did.
      return {
        status: raw,
        label: "supported by a fact",
        tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
        verdict: "established",
        explanation: ELEMENT_STATUS_EXPLANATION.established,
        unknown: false,
      };
    case "not_confirmed":
      return {
        status: raw,
        label: "not confirmed at the required confidence",
        tone: "text-amber-400 border-amber-500/40 bg-amber-500/10",
        verdict: null,
        explanation: ELEMENT_STATUS_EXPLANATION.not_confirmed,
        unknown: false,
      };
    case "not_established":
      return {
        status: raw,
        label: "not supported by these facts",
        tone: "text-[var(--color-text-dim)] border-[var(--color-border)]",
        verdict: "not_established",
        explanation: ELEMENT_STATUS_EXPLANATION.not_established,
        unknown: false,
      };
    case "not_evaluated_second_unavailable":
      return {
        status: raw,
        label: "not evaluated — second judge unavailable",
        tone: "text-sky-400 border-sky-500/40 bg-sky-500/10",
        verdict: null,
        explanation: ELEMENT_STATUS_EXPLANATION.not_evaluated_second_unavailable,
        unknown: false,
      };
    case "not_evaluated_gate1_unavailable":
      // Operator decision, 2026-09-26: its own status and its own presentation, visibly different from BOTH
      // not_established and not_evaluated_second_unavailable. Violet rather than the sky of the second-judge
      // case, so the two "not evaluated" reasons are never confused for one another at a glance.
      //
      // Wording: the decision first spelled this "Not evaluated: entailment check unavailable", was then
      // lowercased, and the reviewer asked for the em-dash separator the fourth status already uses, so the
      // five labels read as one set. The em-dash form below supersedes both earlier spellings.
      return {
        status: raw,
        label: "not evaluated — entailment check unavailable",
        tone: "text-violet-400 border-violet-500/40 bg-violet-500/10",
        verdict: null,
        explanation: ELEMENT_STATUS_EXPLANATION.not_evaluated_gate1_unavailable,
        unknown: false,
      };
    default:
      return unhandledStatus(raw);
  }
}
