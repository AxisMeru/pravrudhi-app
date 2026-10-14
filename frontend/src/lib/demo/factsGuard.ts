// The classes of identifier an example's FACTS must never carry (Lead-2's 14 Oct ruling narrowed the guard to the facts: the citation is a separate, pinned field).
// Each class has the regex and one known-bad sample; example.spec.ts proves both arms (every regex catches its own bad sample, no example's facts match any, the
// redaction placeholders pass), so deleting or weakening a regex fails a test. The address class is a pattern guard only: Track B's source check owns the full address and
// exclusion-list screen.
export interface FactsGuardClass { name: string; re: RegExp; bad: string }

export const FACTS_GUARD: readonly FactsGuardClass[] = [
  { name: "crime number", re: /Cr\.?\s?No(?!\.?\[redacted\])/i, bad: "registered in Cr.No. 1 of 2000" },
  { name: "FIR number", re: /\bFIR\b\s*(?:No|number)/i, bad: "FIR No. 1/2000 was registered" },
  { name: "crime number (words)", re: /\bcrime\s+(?:no|number)/i, bad: "in crime number 1 of 2000" },
  { name: "dotted date", re: /\b\d{1,2}\.\d{1,2}\.\d{4}\b/, bad: "on 01.01.2000 the complaint" },
  { name: "CNR", re: /CNR|HCMA/, bad: "CNR XXXX000000000000" },
  { name: "phone number", re: /(?:\+?91[-\s]?)?\b[6-9]\d{9}\b/, bad: "called 9000000000 twice" },
  { name: "age", re: /\baged\s+\d{1,2}\b|\b\d{1,2}\s*years?\s*old\b|\b\d{1,2}[-\s]year[-\s]old\b/i, bad: "the accused, aged 40, said" },
  { name: "address", re: /\b(?:r\/o|resident(?:s)? of|residing at|door\s+no|plot\s+no|flat\s+no)\b|\b\d+[\/-]\d+[A-Z]?,?\s+[A-Z][a-z]+\s+(?:Street|Road|Nagar|Colony|Lane|Avenue)\b/i, bad: "r/o 1/1, Sample Nagar" },
];
