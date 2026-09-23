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
//   1. The word "verified" may not appear anywhere in this surface's copy, including CAPABILITY_LABEL
//      itself — the label says "checked", not "verified", by the reviewer's own choice of word.
//      `nyayaLean.spec.ts` checks every string this module exports for it.
//   2. No per-vendor lift number may be shown anywhere on this surface until the reviewer sends an accepted
//      sha for one. Nothing here computes or renders one; ELEMENT_APPLICATION_STATUS is text, not a number.

/** The fixed label. Exact string, no stronger wording — operator ruling, non-negotiable. */
export const CAPABILITY_LABEL = "Lean-checked citation licensing";

/** What checker="lean" actually does, scoped to what it actually checks (not "the answer's citations"
 * generally, and not "a fixed set of statutory conditions" — a hand-authored contract, not the statute). */
export const CAPABILITY_DESCRIPTION =
  "for questions with a compiled contract, a Lean checker names any cited claim the contract does not " +
  "license and any required element the answer omits. Questions without a contract are not checked.";

/** The element-application status, rewritten 2026-09-23 to describe what a user actually sees on this
 * page today rather than an internal gate's status (the lead's instruction: no gate numbers in the
 * UI). The registry checker is real and live; what's honestly not automated is who decides each
 * element's Met/Not-Met status -- a person, on the Element audit tab, not the model. */
export const ELEMENT_APPLICATION_STATUS =
  "The registry checker is live for all 14 BNS/IPC contracts. On the Element audit tab, the per-element " +
  "Met/Not-Met judgment is supplied by the person using it, not derived automatically from the model's " +
  "own reasoning. Trained element judges exist but are not served on this surface yet.";

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
