// Reference-only contracts (operator 13 Oct, via Lead-2: the MVP app avoids spelling out explicit offences). For these contracts the app never shows the engine's element wording, the
// rule or provision text or the statute line: each row carries a reference label, the status chip and the user's own cited fact. The engine contract is unchanged and the run record keeps the
// engine's text exactly as received. R1's strings (14 Oct): the ingredient label, the defence label and the what-to-check line.
import { DEFENCE_PHRASE } from "./copy";

/** The contracts shown by their statutory reference only, and that reference. */
export const REFERENCE_ONLY: Readonly<Record<string, string>> = { bns69: "BNS 69" };
export const referenceOf = (contractId: string): string | null => REFERENCE_ONLY[contractId] ?? null;

/** Shown under every row of a reference-only contract, and in the memo row. */
export const REFERENCE_WHAT_TO_CHECK = "Check the cited fact against the section.";

/** "BNS 69 · ingredient 2" (1-based position among the ingredient rows, in the engine's order); a defence reads "BNS 69 · a fact that may defeat the claim", with " 2" and so on when there are several. */
export function referenceRowLabel(ref: string, ordinal: number, isDefence: boolean, defenceCount: number): string {
  if (!isDefence) return `${ref} · ingredient ${ordinal}`;
  return `${ref} · ${DEFENCE_PHRASE}${defenceCount > 1 ? ` ${ordinal}` : ""}`;
}

/** The label to show for one element of a contract, or null where the contract shows its own wording. */
export function displayElementName(contract: { contract_id: string; elements?: ReadonlyArray<{ element: string; is_denial: boolean }> }, el: { element: string; is_denial: boolean }): string | null {
  const ref = referenceOf(contract.contract_id);
  if (!ref) return null;
  const same = (contract.elements ?? []).filter((e) => e.is_denial === el.is_denial);
  const at = same.findIndex((e) => e === el);
  const ordinal = (at >= 0 ? at : same.findIndex((e) => e.element === el.element)) + 1;
  return referenceRowLabel(ref, Math.max(ordinal, 1), el.is_denial, same.length);
}
