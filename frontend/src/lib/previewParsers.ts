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

// ---------- B3 section 138 checklist ----------
export interface B3Input { role: string; text: string; readAs: string | null; dayFirst: boolean; confirmed: boolean; problems: string[] }
export interface B3Step { title: string; clause: string | null; status: string; result: string | null; refer: string[]; counts: { convention: string; periodEnds: string | null; status: string | null }[]; notes: string[] }
export interface B3View { statement: string | null; description: string | null; rule: string | null; inputs: B3Input[]; steps: B3Step[]; notAssessed: string[]; notes: string[] }
export function parseB3(b: Rec | null): B3View | null {
  if (!b || typeof b.run_id !== "string") return null;
  return {
    statement: str(b.statement),
    description: str(b.description),
    rule: str(rec(b.conventions)?.rule),
    inputs: arr(b.inputs).flatMap((i) => { const r = rec(i); const role = str(r?.role), text = str(r?.text); return r && role && text !== null ? [{ role, text, readAs: str(r.read_as), dayFirst: r.day_first_assumed === true, confirmed: r.confirmed === true, problems: strs(r.problems) }] : []; }),
    steps: arr(b.steps).flatMap((s) => {
      const r = rec(s); const title = str(r?.title), status = str(r?.status);
      if (!r || !title || !status) return [];
      const counts = rec(r.counts);
      return [{ title, clause: str(r.clause), status, result: str(r.result), refer: arr(r.refer).flatMap((x) => { const t = str(rec(x)?.text); return t ? [t] : []; }), counts: ["A", "B"].flatMap((k) => { const c = rec(counts?.[k]); const conv = str(c?.convention); return c && conv ? [{ convention: conv, periodEnds: str(c.period_ends), status: str(c.status) }] : []; }), notes: strs(r.notes) }];
    }),
    notAssessed: strs(b.not_assessed),
    notes: strs(b.notes),
  };
}

// ---------- Cheque case check (B3 + A5 on one screen; Track A's samples cheque_case_*.json) ----------
export const CASE_ROLES = ["cheque", "presentation", "memo", "information", "notice", "receipt"] as const;
export type CaseRoleName = (typeof CASE_ROLES)[number];
export interface CaseCandidate { id: string; value: string; readAs: string | null; readings: string[]; ambiguous: boolean; source: string | null; quote: string | null }
export interface CaseRole { role: CaseRoleName; label: string; candidates: CaseCandidate[]; noCandidate: string | null }
export interface CaseCheckView { statement: string | null; roles: CaseRole[]; notUsableLine: string | null; notUsable: string[]; agenda: A5View | null; checklist: B3View | null; pending: string | null; notAssessed: string[] }
export function parseCaseCheck(b: Rec | null): CaseCheckView | null {
  if (!b || typeof b.run_id !== "string") return null;
  const c = rec(b.candidates);
  const roles = rec(c?.roles), labels = rec(c?.role_labels), none = rec(c?.no_candidate);
  return {
    statement: str(b.statement),
    roles: CASE_ROLES.map((role): CaseRole => ({
      role,
      label: str(labels?.[role]) ?? role,
      noCandidate: str(none?.[role]),
      candidates: arr(roles?.[role]).flatMap((x): CaseCandidate[] => {
        const r = rec(x); const id = str(r?.candidate_id), value = str(r?.value);
        return r && id && value !== null ? [{ id, value, readAs: str(r.read_as), readings: strs(r.readings), ambiguous: r.ambiguous === true, source: str(r.source), quote: str(r.quote) }] : [];
      }),
    })),
    notUsableLine: str(c?.not_usable_line),
    notUsable: arr(c?.not_usable).flatMap((x) => { const r = rec(x); const v = str(r?.value); return v ? [[v, str(r?.source)].filter(Boolean).join(", ")] : []; }),
    agenda: parseA5(rec(b.agenda)),
    checklist: parseB3(rec(b.checklist)),
    pending: str(b.checklist_pending),
    notAssessed: strs(b.not_assessed),
  };
}

/**
 * The B3 request body for the dates the user picked: every date an object, sent as the paper wrote it with the paper as its source, confirmed ONLY by the engine's own reading. An ambiguous
 * candidate needs the user's choice among its readings and is sent as that ISO date (an unambiguous text), confirmed as itself. Returns null when no date is picked.
 */
export function caseB3Body(picks: Partial<Record<(typeof CASE_ROLES)[number], { c: CaseCandidate; reading: string | null }>>, extra: { validityMonths?: number; noticeMode?: string } = {}): Record<string, unknown> | null {
  const obj = (p: { c: CaseCandidate; reading: string | null }) => {
    const iso = p.c.ambiguous ? p.reading : p.c.readAs;
    if (!iso) return null;
    return { value: p.c.ambiguous ? iso : p.c.value, source: p.c.source ?? "papers", confirmed: true, confirmed_as: iso, also_in_other_text: false };
  };
  const one = (r: (typeof CASE_ROLES)[number]) => { const p = picks[r]; const o = p ? obj(p) : null; return o ? [o] : []; };
  const body: Record<string, unknown> = { presentations: one("presentation"), return_memos: one("memo"), information_received: one("information"), notices: one("notice"), notice_receipts: one("receipt") };
  const cheque = one("cheque")[0];
  if (cheque) body.cheque_date = cheque;
  if (extra.validityMonths) body.validity_months = extra.validityMonths;
  if (extra.noticeMode) body.notice_mode = extra.noticeMode;
  return cheque || Object.values(body).some((v) => Array.isArray(v) && v.length) ? body : null;
}
// ---------- Matter hearing pack (Track A's samples matter_hearing_pack_*.json; engine PR #541; route is Track C's) ----------
export interface HearingRow { dateAsWritten: string; readings: string[]; readAs: string | null; quote: string | null; source: string | null }
export interface HearingCitation { text: string; where: string[]; status: string }
export interface HearingView {
  statement: string | null; hearingDateGiven: string | null;
  nextDates: { heading: string | null; rows: HearingRow[]; noneLine: string | null };
  timeline: { heading: string | null; rows: HearingRow[]; cutLine: string | null };
  notAdded: { heading: string | null; rows: string[]; noneLine: string | null };
  citations: { heading: string | null; switchedOn: boolean; line: string | null; needsAttention: HearingCitation[]; notChecked: HearingCitation[]; sweepSummary: string | null; note: string | null };
  papers: string[]; notAssessed: string[];
}
const hearingRows = (x: unknown): HearingRow[] => arr(x).flatMap((v): HearingRow[] => {
  const r = rec(v); const d = str(r?.date_as_written);
  return r && d !== null ? [{ dateAsWritten: d, readings: strs(r.readings), readAs: str(r.read_as), quote: str(r.quote), source: str(r.source) }] : [];
});
const hearingCitations = (x: unknown): HearingCitation[] => arr(x).flatMap((v): HearingCitation[] => {
  const r = rec(v); const t = str(r?.text);
  if (!r || !t) return [];
  const where = arr(r.where).flatMap((w) => { const q = rec(w); const n = str(q?.document_name); const p = num(q?.page); return n ? [p !== null ? `${n} p.${p}` : n] : []; });
  return [{ text: t, where, status: strs(r.statuses)[0] ?? "not_checked" }];
});
export function parseHearing(b: Rec | null): HearingView | null {
  if (!b || typeof b.run_id !== "string") return null;
  const nd = rec(b.next_dates), tl = rec(b.timeline), na = rec(b.not_added), ci = rec(b.citations), pp = rec(b.papers);
  return {
    statement: str(b.statement), hearingDateGiven: str(b.hearing_date_given),
    nextDates: { heading: str(nd?.heading), rows: hearingRows(nd?.rows), noneLine: str(nd?.none_line) },
    timeline: { heading: str(tl?.heading), rows: hearingRows(tl?.rows), cutLine: str(tl?.cut_line) },
    notAdded: { heading: str(na?.heading), rows: arr(na?.rows).flatMap((x) => { const l = str(rec(x)?.label); return l ? [l] : []; }), noneLine: str(na?.none_line) },
    citations: { heading: str(ci?.heading), switchedOn: ci?.switched_on === true, line: str(ci?.line), needsAttention: hearingCitations(ci?.needs_attention), notChecked: hearingCitations(ci?.not_checked), sweepSummary: str(ci?.sweep_summary), note: str(ci?.note) },
    papers: arr(pp?.read).flatMap((p) => { const n = paperName(p); return n ? [n] : []; }),
    notAssessed: strs(b.not_assessed),
  };
}
