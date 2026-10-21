// Calls to the engine's preview-workflow routes (Track C's contract ENGINE_API_CONTRACT_PREVIEW_WORKFLOWS_2026-10-17.md sha12 32da95801e55, Track A's responses 2a65124eacbb).
// The routes are not in OpenAPI, so every answer is read through small guards: a field of the wrong type is dropped, never shown half. Strings the engine words are shown as given by the caller.
import { apiBase, engineFetch, requireSession } from "./api";
import { rowScan, type RowScan } from "./scannedIntake";

export interface PreviewAnswer {
  status: number;
  body: Record<string, unknown> | null;
}

/** POST a JSON body to /api/v1<path>; any status is returned (the caller maps 409/422/503 to R1's lines), a network failure throws. */
export async function previewPost(path: string, body: unknown, signal?: AbortSignal, passive = false): Promise<PreviewAnswer> {
  await requireSession({ signal });
  // passive: a read the page makes on its own (the matters list): a 401 answers as a status instead of sending the visitor to sign in, so merely opening the page never navigates away
  const res = await engineFetch(`${apiBase()}/api/v1${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal, authOptional: passive });
  let parsed: unknown = null;
  try { parsed = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, body: typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null };
}

export const str = (x: unknown): string | null => (typeof x === "string" ? x : null);
export const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const HEX32 = /^[0-9a-f]{32}$/;
export const matterIdOf = (b: Record<string, unknown> | null): string | null => (b && typeof b.matter_id === "string" && HEX32.test(b.matter_id) ? b.matter_id : null);

export interface PaperRow { docId: string; name: string; pages: number | null; pagesWithoutText: number[]; complete: boolean; scan?: RowScan }

export function parsePapers(b: Record<string, unknown> | null): { papers: PaperRow[]; pagesNote: string | null } {
  const docs = Array.isArray(b?.documents) ? (b!.documents as unknown[]) : [];
  const papers = docs.flatMap((d): PaperRow[] => {
    if (typeof d !== "object" || d === null) return [];
    const r = d as Record<string, unknown>;
    const docId = str(r.doc_id), name = str(r.name);
    if (!docId || name === null) return [];
    return [{ docId, name, pages: num(r.n_pages), pagesWithoutText: Array.isArray(r.pages_without_text) ? (r.pages_without_text as unknown[]).filter((p): p is number => typeof p === "number") : [], complete: r.indexed_complete === true, ...(((x: RowScan | undefined) => (x ? { scan: x } : {}))(rowScan(r, name))) }];
  });
  return { papers, pagesNote: str(b?.pages_note) };
}

export interface MyMatter { matterId: string; papers: number }
/** The engine's list of the signed-in organisation's matters (POST /matter-spans/my-matters; engine #597/#599): {matters: [{matter_id, papers}], truncated}. Only well-formed rows are kept (a 32-hex id and a non-negative whole count); `truncated` is true only when the engine says so. No names or text exist in this answer. */
export function parseMyMatters(b: Record<string, unknown> | null): { matters: MyMatter[]; truncated: boolean } | null {
  if (!b || !Array.isArray(b.matters)) return null;
  const matters = (b.matters as unknown[]).flatMap((m): MyMatter[] => {
    if (typeof m !== "object" || m === null) return [];
    const r = m as Record<string, unknown>;
    const id = matterIdOf(r), n = num(r.papers);
    return id && n !== null && Number.isInteger(n) && n >= 0 ? [{ matterId: id, papers: n }] : [];
  });
  return { matters, truncated: b.truncated === true };
}

/** Every string inside a value, in the engine's order (a string, a list of strings, or an object whose values are strings); anything else is skipped. */
export function stringsOf(x: unknown): string[] {
  if (typeof x === "string") return [x];
  if (Array.isArray(x)) return x.flatMap(stringsOf);
  if (typeof x === "object" && x !== null) return Object.values(x as Record<string, unknown>).flatMap(stringsOf);
  return [];
}

/** The S3 quashing agenda fields, in the contract's order, each as the engine's strings; nothing is added, nothing is dropped. */
export const AGENDA_FIELDS = ["standing_line", "relief_line", "categories_line", "heading", "stem", "caution", "categories", "papers", "fact_line", "one_sentence", "quotes_line", "order_line", "code_numbers_line", "data_statement", "screening_aid", "bridge_guard", "not_assessed"] as const;
export function parseAgenda(b: Record<string, unknown> | null): { key: (typeof AGENDA_FIELDS)[number]; lines: string[] }[] | null {
  if (!b || typeof b.run_id !== "string") return null;
  return AGENDA_FIELDS.map((key) => ({ key, lines: stringsOf(b[key]) })).filter((f) => f.lines.length > 0);
}
