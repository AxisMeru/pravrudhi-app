// Show the supporting quote in its fact, at the engine's offsets. The engine locates a quote with an exact find in the
// named fact and returns `start`/`end` itself (`offsets_source: "system"`): they count Unicode code points (Python str
// indexes), not UTF-16 units, so a fact with an emoji or another astral character would shift every later highlight if
// the offsets were used on a JS string directly. This module converts by code points, and it shows a highlight only when
// the slice at those offsets is exactly the quote the engine returned; any other case falls back to the plain quote.

export interface QuoteFields {
  fact_id: string | null;
  quote: string | null;
  start: number | null;
  end: number | null;
  offsets_source: string | null;
}

export type PlainReason = "no_quote" | "offsets_not_from_engine" | "fact_not_found" | "offsets_invalid" | "offsets_do_not_match_quote";

export type QuoteView =
  | { kind: "highlight"; factId: string; before: string; quote: string; after: string; cutBefore: boolean; cutAfter: boolean }
  | { kind: "plain"; reason: PlainReason };

/** Characters of the fact shown on each side of the quote. */
export const CONTEXT_CHARS = 80;

const isIndex = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

export function highlightQuote(facts: ReadonlyArray<{ id: string; text: string }>, el: QuoteFields, context: number = CONTEXT_CHARS): QuoteView {
  if (!el.quote) return { kind: "plain", reason: "no_quote" };
  if (el.offsets_source !== "system") return { kind: "plain", reason: "offsets_not_from_engine" };
  const fact = el.fact_id === null ? undefined : facts.find((f) => f.id === el.fact_id);
  if (!fact) return { kind: "plain", reason: "fact_not_found" };
  const cps = Array.from(fact.text);
  const { start, end } = el;
  if (!isIndex(start) || !isIndex(end) || start >= end || end > cps.length) return { kind: "plain", reason: "offsets_invalid" };
  const quote = cps.slice(start, end).join("");
  if (quote !== el.quote) return { kind: "plain", reason: "offsets_do_not_match_quote" };
  const from = Math.max(0, start - context);
  const to = Math.min(cps.length, end + context);
  return {
    kind: "highlight",
    factId: fact.id,
    before: cps.slice(from, start).join(""),
    quote,
    after: cps.slice(end, to).join(""),
    cutBefore: from > 0,
    cutAfter: to < cps.length,
  };
}

export interface LeanAttestation {
  binary_sha256: string;
  wire_sha256: string;
  verdict: string;
}

export interface LeanAttestationView {
  /** What the hashes are, in plain words; never says the facts or the law were verified. */
  note: string;
  rows: { label: string; full: string; short: string }[];
}

export const LEAN_ATTESTATION_NOTE =
  "These two hashes name the checker program and the exact input it was given, so the same check can be reproduced by anyone who has both. The check is structural: it checks that the element results returned by the judges combine into the contract outcome shown, according to the contract's structure. It does not show that your facts are true or that the law is correctly applied.";

const SHA = /^[0-9a-f]{64}$/;

/** The attestation as shown, or null when the engine sent none or a malformed one (nothing is invented for a gap). */
export function leanAttestationView(a: LeanAttestation | null | undefined): LeanAttestationView | null {
  if (!a || !SHA.test(a.binary_sha256 ?? "") || !SHA.test(a.wire_sha256 ?? "")) return null;
  const row = (label: string, full: string) => ({ label, full, short: `${full.slice(0, 12)}…` });
  return {
    note: LEAN_ATTESTATION_NOTE,
    rows: [row("Checker program (sha256)", a.binary_sha256), row("Input given to it (sha256)", a.wire_sha256)],
  };
}

/** The line shown where the structural-check block would be, on a referral for which none ran (R1-signed wording, option 2). */
export const NO_STRUCTURAL_CHECK_LINE = "No structural check was run for this referral.";

/** The line for a REFER contract with no Lean result; null for any contract that has a structural check, and for any other outcome. */
export function noStructuralCheckLine(outcome: string, lean: unknown): string | null {
  return outcome === "REFER_TO_LAWYER" && lean === null ? NO_STRUCTURAL_CHECK_LINE : null;
}
