// The "Section lookup" card (#1016): an old IPC or CrPC section against the NCRB Corresponding Section Table, read-only, no model, no matter. Contract: Track B's B1_CONTRACT_DOC_2026-10-19.md (sha12 dbfc240c6448),
// engine PR #560 (flag wf_b1_section_lookup). OFF by default in the app too: NEXT_PUBLIC_SECTION_LOOKUP=1 (exactly "1"). The sentences of the answer are the engine's (R1's b1_* strings, signed 0be8f6831ec8) and are shown EXACTLY as sent.
// The UI branches ONLY on `state`; it never computes a state, never shows an icon/score/badge/colour that says "match", and adds no words like equivalent, replaces, same as, current or in force.
export const SECTION_LOOKUP = process.env.NEXT_PUBLIC_SECTION_LOOKUP === "1";

export type LookupState = "one_to_one" | "check_both" | "no_match" | "not_in_table";
export interface LookupBody { id: string | null; held: boolean; lines: string[]; section: string | null; title: string | null; text: string | null }
export interface LookupView { state: LookupState; code: string; section: string; line: string; tableSourceLine: string; lawyerLine: string; old: LookupBody; news: LookupBody[] }

const STATES: readonly string[] = ["one_to_one", "check_both", "no_match", "not_in_table"];
const rec = (x: unknown): Record<string, unknown> | null => (typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const s = (x: unknown): string | null => (typeof x === "string" ? x : null);

function body(x: unknown): LookupBody | null {
  const r = rec(x); if (!r || typeof r.held !== "boolean") return null;
  const lines = Array.isArray(r.lines) ? r.lines.filter((l): l is string => typeof l === "string") : null;
  if (!lines) return null;
  const text = s(r.text);
  // a body that is held must carry its text and the lines that go beside it; a body that is not held shows only its not-held line
  if (r.held && (text === null || text === "")) return null;
  return { id: s(r.id), held: r.held, lines, section: s(r.section), title: s(r.title), text: r.held ? text : null };
}

/** The answer as a view, or null when it is not the contract's shape (the card then says the look-up is not available: a non-JSON or unknown answer is never half shown). */
export function parseLookup(b: Record<string, unknown> | null): LookupView | null {
  if (!b) return null;
  const state = s(b.state), line = s(b.line), src = s(b.table_source_line), lawyer = s(b.lawyer_line), code = s(b.code), section = s(b.section);
  if (!state || !STATES.includes(state) || line === null || src === null || lawyer === null || code === null || section === null) return null;
  const old = body(b.old); if (!old) return null;
  const rawNew = b.new; if (!Array.isArray(rawNew)) return null;
  const news = rawNew.map(body); if (news.some((n) => n === null)) return null;
  const v: LookupView = { state: state as LookupState, code, section, line, tableSourceLine: src, lawyerLine: lawyer, old, news: news as LookupBody[] };
  // the contract's own invariants: one_to_one lists exactly one new body, no_match and not_in_table list none, not_in_table holds no old body
  if (v.state === "one_to_one" && v.news.length !== 1) return null;
  if ((v.state === "no_match" || v.state === "not_in_table") && v.news.length > 0) return null;
  if (v.state === "not_in_table" && v.old.held) return null;
  return v;
}

/** What the user typed, trimmed and upper-cased, or null when it is not 1-3 digits plus up to 3 letters (nothing is sent then). */
export function normaliseSection(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  return /^[0-9]{1,3}[A-Z]{0,3}$/.test(t) ? t : null;
}

export type LookupCode = "IPC" | "CrPC";
export const lookupBody = (code: LookupCode, section: string): { code: LookupCode; section: string } => ({ code, section });

/** The bodies in reading order for a view: the old body first, then every new body in the engine's order (no ranking, no filtering). */
export function readingOrder(v: LookupView): LookupBody[] {
  return [v.old, ...v.news].filter((b, i) => i > 0 || v.state !== "not_in_table");
}
