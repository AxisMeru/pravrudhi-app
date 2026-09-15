// The Lean-checked citation licensing capability (Track A P1/P1b, ADR-0003): what the page is allowed to
// say about it, in one place, so a scattered copy edit can never drift from what the reviewer signed off.
//
// Every string here is verbatim from track-a-adversarial-review-ae6770-43's sign-off (2026-09-15), given
// against what pravrudhi main actually runs (src/pravrudhi/application/nyaya_lean.py). Do not edit these
// strings without a fresh sign-off from that reviewer, and route any new string on this page that describes
// what the checker does through them first — session names don't survive turnover, so the durable record is
// the pravrudhi review branch `claude/track-a-adversarial-review-ae6770`,
// `docs/reviews/liaison-log.md`, entry "pravrudhi-04 (product surface)". Two standing rules that came with
// the sign-off, enforced by this module's shape rather than left as a comment someone can miss:
//
//   1. The word "verified" may appear only inside CAPABILITY_LABEL ("Lean-checked citation licensing"),
//      nowhere else on the page. `nyayaLean.spec.ts` greps the rendered page for it.
//   2. No per-vendor lift number may be shown anywhere on this surface until the reviewer sends an accepted
//      sha for one. Nothing here computes or renders one; ELEMENT_APPLICATION_STATUS is text, not a number.

/** The fixed label. Exact string, no stronger wording — operator ruling, non-negotiable. */
export const CAPABILITY_LABEL = "Lean-checked citation licensing";

/** What checker="lean" actually does, scoped to what it actually checks (not "the answer's citations"
 * generally, and not "a fixed set of statutory conditions" — a hand-authored contract, not the statute). */
export const CAPABILITY_DESCRIPTION =
  "for questions with a compiled contract, a Lean checker names any cited claim the contract does not " +
  "license and any required element the answer omits. Questions without a contract are not checked.";

/** The element-application/checker-lift claim, deferred honestly rather than hidden or overstated. P2.5 has
 * started; the first attempt measured no contribution beyond retrieval, not "came back null". */
export const ELEMENT_APPLICATION_STATUS =
  "Element-by-element application checking is not yet claimed. Measured on LegalBench (hearsay, personal " +
  "jurisdiction, two vendors): the checker added nothing beyond retrieval. A structural decider is being " +
  "built (gate P2.5); no number until it passes.";

/** One contract this workspace's compiled Lean binary knows how to check, per `nyaya_lean.KNOWN_CONTRACT_IDS`
 * (src/pravrudhi/application/nyaya_lean.py). Kept in sync by hand — there is no listing endpoint yet, and the
 * backend refuses any contract_id not in that set regardless of what this list offers, so a stale entry here
 * fails safely (a 4xx from checker=lean, not a wrong verdict) rather than unsafely. Update this list, and only
 * this list, when `_CONTRACTS` in that module changes. */
export interface LeanContract {
  id: string;
  label: string;
}

export const LEAN_CONTRACTS: LeanContract[] = [
  { id: "0", label: "Pierce v. State (F.2d)" },
  { id: "5", label: "Rowan v. Fisk (U.S.)" },
];

/** The synthetic "checker" value the Ask/Audit tabs use in their existing vendor-id dropdown to mean
 * "run checker=lean" rather than "audit with this vendor". Never sent to the API as-is; the caller must
 * also supply a contract_id and send `checker: "lean"`. */
export const LEAN_CHECKER_OPTION = "lean" as const;
