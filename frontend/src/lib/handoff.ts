// A one-time, in-memory hand-off of the chosen facts from the Intake page to the Screening page. It lives only in this tab's JavaScript memory (a client-side navigation keeps it);
// nothing is written to storage or a URL, so the Data handling page's list of stored keys stays true. Taken once, then cleared; a reload loses it, by design.
let pending: string[] | null = null;
export function setHandoff(facts: readonly string[]): void { pending = [...facts]; }
export function takeHandoff(): string[] | null { const p = pending; pending = null; return p; }

// The citations Intake found in the pasted text travel with the chosen facts the same way (in memory, taken once): Hearing preparation lists them under "Found in the text you pasted".
let pendingCitations: Array<{ text: string }> = [];
export function setHandoffCitations(citations: ReadonlyArray<{ text: string }>): void { pendingCitations = citations.map((c) => ({ text: c.text })); }
export function takeHandoffCitations(): Array<{ text: string }> { const p = pendingCitations; pendingCitations = []; return p; }
