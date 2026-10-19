// The mandatory sensitive-case declaration before any A4 bail draft or A8 synopsis (pravrudhi#558; Track C's design note SENSITIVE_DECLARATION_DESIGN_2026-10-19.md sha12 1618af4b150e).
// OFF by default: NEXT_PUBLIC_SENSITIVE_DECLARATION=1 (exactly "1"). Words: R1's A4_DECLARATION_V4_R1_2026-10-19.md (sha12 e21f8c55df95, supersedes the checkbox of A4_LINE_V3), pinned by hash in sensitiveDeclaration.spec.ts.
// The engine takes `sensitive_declaration`: "none" | "sensitive", NO default, and refuses a request without it (422, error sensitive_declaration_required). The choice starts empty every time; the button is disabled until one is made;
// "none" or "sensitive" is sent exactly as chosen. Choosing "none" is the lawyer's statement, not a check the tool makes: nothing here says checked, screened or protected.
export const SENSITIVE_DECLARATION = process.env.NEXT_PUBLIC_SENSITIVE_DECLARATION === "1";

export const DECLARATION_TEXT = {
  legend: "Does this matter involve a person under 18, a sexual offence or trafficking?",
  none: "No. None of these is involved in this matter.",
  sensitive: "Yes. At least one of these is involved in this matter.",
  missing: "Say whether this matter involves a person under 18, a sexual offence or trafficking before a draft can be made.",
} as const;

export type Declaration = "" | "none" | "sensitive";

/** The request with the declaration: with the flag off the body is unchanged; with it on, no body at all until a choice is made, then `sensitive_declaration` exactly as chosen. */
export function withDeclaration(body: Record<string, unknown> | null, choice: Declaration, enabled: boolean = SENSITIVE_DECLARATION): Record<string, unknown> | null {
  if (!enabled || body === null) return body;
  return choice === "" ? null : { ...body, sensitive_declaration: choice };
}

/** The engine's coded refusal when the declaration was missing or invalid: the page shows R1's line (a4_declaration_missing, the same words as the engine's detail). */
export const isDeclarationRefusal = (status: number, body: Record<string, unknown> | null): boolean => status === 422 && body?.error === "sensitive_declaration_required";

/** R1's "say whether" line shows beside the question while nothing is chosen and everything else the draft needs is in place (the button is then disabled only for want of the answer). */
export const showDeclarationMissing = (enabled: boolean, choice: Declaration, baseReady: boolean): boolean => enabled && choice === "" && baseReady;
