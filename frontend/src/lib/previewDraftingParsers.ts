// View models for the bail-drafting and synopsis/list-of-dates answers (Track C's contract ENGINE_API_CONTRACT_DRAFTING_AND_CARDS_2026-10-17.md d5ba47623740; samples real engine output with a fake model answer).
// Every reader drops what is not of the expected type; the engine's sentences are shown as sent, and the label of every answer is kept for the page to show.
import { num, str, stringsOf } from "./previewApi";
import { docNameOf, rowScan, type RowScan } from "./scannedIntake";

type Rec = Record<string, unknown>;
const rec = (x: unknown): Rec | null => (typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Rec) : null);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const strs = (x: unknown): string[] => arr(x).filter((v): v is string => typeof v === "string");

export type DraftState = "drafted" | "template_only" | "table_only" | "referred" | "refused";
const STATES: readonly string[] = ["drafted", "template_only", "table_only", "referred", "refused"];
/** The draft body: under `draft` in the route's answer, or the answer itself when it carries the tables (Track A's page-level samples). */
const bodyOf = (b: Rec): Rec | null => rec(b.draft) ?? (b.list_of_dates || b.synopsis ? b : null);

interface Common {
  label: string | null;
  state: DraftState;
  referral: { code: string | null; text: string } | null;
  factsSetAside: number | null;
  notes: string[];
  moreNotes: string[];
  fillIns: string[];
}
function common(b: Rec): Common | null {
  if (typeof b.run_id !== "string" || !STATES.includes(b.state as string)) return null;
  const d = bodyOf(b);
  const ref = rec(b.referral);
  const refText = str(ref?.text) ?? str(b.refused) ?? str(d?.refused);
  return {
    label: str(b.label),
    state: b.state as DraftState,
    referral: refText ? { code: str(ref?.code), text: refText } : null,
    factsSetAside: num(b.facts_set_aside),
    notes: strs(d?.notes_for_lawyer),
    moreNotes: strs(d?.more_notes),
    fillIns: stringsOf(d?.fill_ins),
  };
}

export interface BailView extends Common {
  framing: { status: string | null; lines: string[]; unconfirmed: string | null } | null;
  text: string | null;
}
export function parseBail(b: Rec | null): BailView | null {
  if (!b) return null;
  const c = common(b);
  if (!c) return null;
  const f = rec(b.framing);
  const d = bodyOf(b);
  return {
    ...c,
    framing: f ? { status: str(f.status), lines: arr(f.options).flatMap((o) => { const l = str(rec(o)?.line); return l ? [l] : []; }), unconfirmed: str(f.unconfirmed_line) } : null,
    text: str(d?.text),
  };
}

/** The row's scan info: its own, or (a date inside the row was read from a scanned page) the first date's, so the engine's marker always shows beside the row. */
const scanOf1 = (r: Rec, docName: string | null, dates: { scan?: RowScan }[] = []): { scan?: RowScan } => { const x = rowScan(r, docName) ?? dates.find((d) => d.scan?.fromOcr)?.scan; return x ? { scan: x } : {}; };
export interface RowDate { written: string; readings: string[]; ambiguous: boolean; scan?: RowScan }
export interface DateRow {
  scan?: RowScan;
  rowId: number | null;
  ref: string | null;
  dateAsWritten: string;
  /** Every date of the row: two dates in one sentence are one row (Track A, engine #543), each with its own readings. */
  dates: RowDate[];
  readings: string[];
  ambiguous: boolean;
  eventLine: string | null;
  eventQuote: string | null;
  source: string | null;
}
export interface SynopsisView extends Common {
  dates: { heading: string | null; columns: string[]; rows: DateRow[]; noneLine: string | null; cutLine: string | null } | null;
  synopsis: { heading: string | null; paragraphs: string[]; fallback: string | null } | null;
  datesNote: string | null;
}
export function parseSynopsis(b: Rec | null): SynopsisView | null {
  if (!b) return null;
  const c = common(b);
  if (!c) return null;
  const d = bodyOf(b);
  const l = rec(d?.list_of_dates);
  const s = rec(d?.synopsis);
  return {
    ...c,
    dates: l ? {
      heading: str(l.heading),
      columns: strs(l.columns),
      rows: arr(l.rows).flatMap((x): DateRow[] => {
        const r = rec(x);
        const written = str(r?.date_as_written);
        if (!r || written === null) return [];
        const own = arr(r.dates).flatMap((x): RowDate[] => { const q = rec(x); const w = str(q?.date_as_written) ?? str(q?.written); return q && w !== null ? [{ written: w, readings: strs(q.readings), ambiguous: q.ambiguous === true, ...scanOf1(q, str(r.document_name) ?? docNameOf(str(r.source))) }] : []; });
        const dates = own.length > 0 ? own : [{ written, readings: strs(r.readings), ambiguous: r.ambiguous === true }];
        return [{ rowId: num(r.row_id), ref: str(r.ref), dateAsWritten: written, dates, readings: strs(r.readings), ambiguous: r.ambiguous === true, eventLine: str(r.event_line), eventQuote: str(r.event_quote), source: str(r.source), ...scanOf1(r, str(r.document_name) ?? docNameOf(str(r.source)), dates) }];
      }),
      noneLine: str(l.none_line),
      cutLine: str(l.cut_line),
    } : null,
    synopsis: s ? { heading: str(s.heading), paragraphs: arr(s.paragraphs).flatMap((p) => { const t = str(rec(p)?.text); return t ? [t] : []; }), fallback: str(s.fallback_line) } : null,
    datesNote: str(d?.dates_note),
  };
}

export const GROUNDS = ["accusation_nature", "custody_period", "antecedents", "flight", "tampering", "co_accused"] as const;
export const TAGS = ["pocso", "minor_involved", "sexual_offence", "marked_sensitive", "trafficking"] as const;
export interface FactIn { text: string; applicant: boolean; grounds: string[] }

/** The facts as the request carries them: empty rows dropped; `side` is the lawyer's tick; grounds only for an applicant fact. */
export const factsBody = (rows: FactIn[]) =>
  rows.filter((r) => r.text.trim() !== "").map((r) => ({ text: r.text.trim().slice(0, 1500), side: r.applicant ? "applicant" : "other", ...(r.applicant && r.grounds.length ? { grounds: r.grounds } : {}) }));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export interface BailForm { consent: boolean; kind: "bail" | "anticipatory_bail"; forum: "trial_court" | "sessions_or_high_court" | ""; offence: string; fir: string; facts: FactIn[]; tags: string[]; sections: string }
/** The bail request, or null while a required declaration is missing (consent, both dates, a forum for bail, one fact). Nothing is inferred. */
export function bailBody(f: BailForm): Record<string, unknown> | null {
  const facts = factsBody(f.facts);
  if (!f.consent || !ISO.test(f.offence) || !ISO.test(f.fir) || facts.length === 0) return null;
  if (f.kind === "bail" && !f.forum) return null;
  const sections = f.sections.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  return { consent: true, kind: f.kind, ...(f.kind === "bail" ? { forum: f.forum } : {}), offence_date: f.offence, fir_date: f.fir, facts, ...(f.tags.length ? { tags: f.tags } : {}), ...(sections.length ? { charged_sections: sections } : {}) };
}
export function synopsisBody(matter: string, consent: boolean, rows: FactIn[], label: string, keep: number[] | null): Record<string, unknown> | null {
  if (!consent) return null;
  const facts = factsBody(rows);
  return { consent: true, matter_id: matter, facts, ...(label.trim() ? { document_label: label.trim().slice(0, 80) } : {}), ...(keep ? { include_row_ids: keep } : {}) };
}
