// View models for the preview workflows' answers (Track A's sample responses and field lists, 2a65124eacbb; samples under trackA/preview/samples/). Every reader drops what is not of the expected type
// and keeps only the fields the page may show: the engine's own sentences as sent, the paper's own words, and the readings the rendering rules require (all readings of an ambiguous date; never custody days).
import { num, str, stringsOf } from "./previewApi";

type Rec = Record<string, unknown>;
const rec = (x: unknown): Rec | null => (typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Rec) : null);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const strs = (x: unknown): string[] => arr(x).filter((v): v is string => typeof v === "string");

/** A paper named in an engine list: a string, or an object with a string `name` (or `document_name`). */
const paperName = (x: unknown): string | null => (typeof x === "string" ? x : str(rec(x)?.name) ?? str(rec(x)?.document_name));

// ---------- A5 review agenda ----------
export interface A5View {
  lines: string[];
  offence: string | null;
  ingredientsHeading: string | null;
  ingredients: { proviso: string | null; words: string }[];
  statuteNames: { heading: string | null; rows: { label: string; tag: string | null; words: string | null; status: string | null; papers: string[] }[] };
  papersRead: { heading: string | null; names: string[] };
  notAdded: { heading: string | null; rows: string[]; noneLine: string | null };
  notAssessed: string[];
}
export function parseA5(b: Rec | null): A5View | null {
  if (!b || typeof b.run_id !== "string") return null;
  const headings = rec(b.headings);
  const names = rec(b.statute_names);
  const notAdded = rec(b.not_added);
  const read = rec(b.papers_read);
  return {
    lines: [b.statement, b.standing_line, b.source_line, b.ownership_line, b.quotes_line].flatMap((x) => (typeof x === "string" ? [x] : [])),
    offence: str(rec(b.offence)?.name),
    ingredientsHeading: str(headings?.ingredients),
    ingredients: arr(b.ingredients).flatMap((i) => { const r = rec(i); const w = str(r?.statute_words); return r && w ? [{ proviso: str(r.proviso), words: w }] : []; }),
    statuteNames: { heading: str(names?.heading) ?? str(headings?.statute_names), rows: arr(names?.rows).flatMap((x) => { const r = rec(x); const l = str(r?.label); return r && l ? [{ label: l, tag: str(r.tag), words: str(r.statute_words), status: str(r.status), papers: arr(r.papers).flatMap((p) => { const n = paperName(p); return n ? [n] : []; }) }] : []; }) },
    papersRead: { heading: str(read?.heading), names: arr(read?.papers).flatMap((p) => { const n = paperName(p); return n ? [n] : []; }) },
    notAdded: { heading: str(notAdded?.heading) ?? str(headings?.not_added), rows: arr(notAdded?.rows).flatMap((x) => { const r = rec(x); const t = str(r?.label) ?? str(r?.line); return t ? [t] : []; }), noneLine: str(notAdded?.none_line) },
    notAssessed: strs(b.not_assessed),
  };
}

// ---------- A3 chronology ----------
export interface A3Row { dateAsWritten: string; howText: string | null; readings: string[]; mentions: string | null; quote: string | null; source: string | null; notes: string[] }
export interface A3Section { key: string; heading: string | null; rows: A3Row[] }
export interface A3View { lines: string[]; headers: { date: string | null; mentions: string | null; sentence: string | null; source: string | null }; sections: A3Section[]; papersRead: string[]; notAdded: string[] }
const A3_SECTIONS: [string, string | null][] = [["events", null], ["ambiguous", "ambiguous"], ["approximate", "approximate"], ["partial_dates", "less_than_a_day"], ["scheduled", "scheduled"], ["undated", "undated"], ["date_not_read", "not_read"]];
export function parseA3(b: Rec | null): A3View | null {
  if (!b || typeof b.run_id !== "string") return null;
  const headings = rec(b.headings), headers = rec(b.headers);
  const row = (x: unknown): A3Row[] => {
    const r = rec(x); const d = str(r?.date_as_written);
    if (!r || d === null) return [];
    const page = num(r.page);
    return [{ dateAsWritten: d, howText: str(r.how_text), readings: strs(r.readings), mentions: str(r.mentions), quote: str(r.quote), source: [str(r.document_name), page !== null ? `p. ${page}` : null].filter(Boolean).join(", ") || null, notes: strs(r.notes) }];
  };
  const sections = A3_SECTIONS.map(([key, hk]): A3Section => ({ key, heading: hk ? str(headings?.[hk]) : null, rows: arr(b[key]).flatMap(row) })).filter((s) => s.rows.length > 0);
  return {
    lines: [b.statement, b.standing_line, b.scope_line, b.language_line, b.denominator_line].flatMap((x) => (typeof x === "string" ? [x] : [])),
    headers: { date: str(headers?.date), mentions: str(headers?.mentions), sentence: str(headers?.sentence), source: str(headers?.source) },
    sections,
    papersRead: arr(b.papers_read).flatMap((p) => { const n = paperName(p); return n ? [n] : []; }),
    notAdded: strs(b.papers_not_added_yet_that_may_matter),
  };
}

// ---------- S1 matter citation sweep and A1 draft citation check ----------
export interface CitationRow { text: string; status: string; reporter: string | null }
export interface S1View { lines: string[]; heading: string | null; papers: { name: string; citations: CitationRow[] }[]; notAssessed: string[]; wording: string | null }
export function parseCitationRows(x: unknown): CitationRow[] {
  return arr(x).flatMap((c) => { const r = rec(c); const t = str(r?.text), s = str(r?.status); return r && t && s ? [{ text: t, status: s, reporter: str(r.reporter) }] : []; });
}
export function parseS1(b: Rec | null): S1View | null {
  if (!b || typeof b.run_id !== "string") return null;
  return {
    lines: [b.summary, b.statement, b.heading_line, b.snapshot_line, b.duplicates_line, b.order_label, b.cut_line].flatMap((x) => (typeof x === "string" ? [x] : [])).concat(strs(b.notes)),
    heading: str(b.heading),
    papers: arr(b.papers_read).flatMap((p) => { const r = rec(p); const n = str(r?.name); return r && n !== null ? [{ name: n, citations: parseCitationRows(r.citations) }] : []; }),
    notAssessed: strs(b.not_assessed),
    wording: str(b.wording),
  };
}
export interface A1View { summary: string | null; citations: CitationRow[]; notAssessed: string[]; wording: string | null }
export function parseA1(b: Rec | null): A1View | null {
  const d = rec(b?.draft_check);
  if (!b || typeof b.run_id !== "string" || !d) return null;
  return { summary: str(d.summary), citations: parseCitationRows(d.citations), notAssessed: strs(d.not_assessed), wording: str(d.wording) };
}

export { stringsOf };
