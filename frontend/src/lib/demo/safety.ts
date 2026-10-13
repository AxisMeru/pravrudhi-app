// The safety page's words (R1's value statements, 13 Oct 2026; Lead-2 decision: the product leads with what the firm gets, with no figures). Every sentence is R1's, word for word.
// Nothing here is a claim about production traffic, another court population or another product. The checks in safety.spec.ts keep these strings exactly.

export const SAFETY_SUBTITLE = "How the screen behaves on real court material, and what that does not cover.";

export const SAFETY_STATEMENTS: readonly string[] = [
  "The screen never states a conclusion about your matter. It suggests facts to check, and anything it cannot support goes back to the lawyer.",
  "In our checks on real court-rejected items it did not return a proof for any of them.",
  "It is cautious by design: on the real court-established items in the same checks it did not return a proof either, so use it as a screen that points you to what to check, not as a source of proofs.",
  "These checks used real court material we had already seen, with two judges that both have to agree, on a mixed development and production setup. They describe that material only: not your matters, not production traffic, and not trial or appellate conviction judgments.",
];

export const ASSIST_LINE = "This assists a lawyer; it is not a verdict.";
export const EVIDENCE_LINE = "Evidence, not legal advice.";

export const SAFETY_COPY: readonly string[] = [SAFETY_SUBTITLE, ...SAFETY_STATEMENTS, ASSIST_LINE, EVIDENCE_LINE];
