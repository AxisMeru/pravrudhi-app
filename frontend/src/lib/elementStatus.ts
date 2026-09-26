// How one element's status is presented, as a pure function of the status string the engine sent — no React
// here, so it can be tested directly and reused by any surface that shows an element (the matters page today,
// the audit views next).
//
// The engine produces FOUR element statuses (AxisMeru/pravrudhi#37, PR #45), not two:
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
] as const;

export type ElementStatus = (typeof ELEMENT_STATUSES)[number];

// Which finding a presentation asserts. `null` means "no finding either way" — used for not_confirmed (the
// judges leaned established but the bar was not met), for the second-judge-unavailable case, and for an
// unrecognised status. Only `established` and `not_established` are verdicts.
export type ElementVerdict = "established" | "not_established";

export interface ElementStatusPresentation {
  // The canonical status this presentation came from, or null when the engine sent something this build does
  // not know. Callers that need to branch on "we could not read this" check `status === null` or `unknown`.
  status: ElementStatus | null;
  label: string;
  // Tailwind utility classes for the badge, in the same shape as the page's own OUTCOME tones. Distinct per
  // status: not_confirmed and not_established must never look alike.
  tone: string;
  verdict: ElementVerdict | null;
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
  unknown: true,
};

export function isElementStatus(status: string): status is ElementStatus {
  return (ELEMENT_STATUSES as readonly string[]).includes(status);
}

// Adding a fifth status to ElementStatus without giving it a presentation is a COMPILE error here: the default
// arm narrows to `never`, and a value of the new status no longer assigns to it.
function unhandledStatus(status: never): never {
  throw new Error(`elementStatusPresentation: unhandled element status ${JSON.stringify(status)}`);
}

// `status` is typed `string` because that is what AnalyseFactsElement carries off the wire — the engine is a
// separate release train and may send a status this build predates. Anything outside the four canonical values
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
        label: "established",
        tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
        verdict: "established",
        unknown: false,
      };
    case "not_confirmed":
      return {
        status: raw,
        label: "not confirmed at the required confidence",
        tone: "text-amber-400 border-amber-500/40 bg-amber-500/10",
        verdict: null,
        unknown: false,
      };
    case "not_established":
      return {
        status: raw,
        label: "not established",
        tone: "text-[var(--color-text-dim)] border-[var(--color-border)]",
        verdict: "not_established",
        unknown: false,
      };
    case "not_evaluated_second_unavailable":
      return {
        status: raw,
        label: "not evaluated — second judge unavailable",
        tone: "text-sky-400 border-sky-500/40 bg-sky-500/10",
        verdict: null,
        unknown: false,
      };
    default:
      return unhandledStatus(raw);
  }
}
