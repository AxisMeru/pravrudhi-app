// A one-time, in-memory hand-off of the chosen facts from the Intake page to the Screening page. It lives only in this tab's JavaScript memory (a client-side navigation keeps it);
// nothing is written to storage or a URL, so the Data handling page's list of stored keys stays true. Taken once, then cleared; a reload loses it, by design.
let pending: string[] | null = null;
export function setHandoff(facts: readonly string[]): void { pending = [...facts]; }
export function takeHandoff(): string[] | null { const p = pending; pending = null; return p; }
