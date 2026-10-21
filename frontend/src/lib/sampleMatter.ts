// The one-click INVENTED sample matter on /matter-tools (Lead-2 P0, 20 Oct): four invented papers (an FIR, a chargesheet extract, a bail order, a cheque memo and notice) so a visitor, and the deploy gate, can run every tool without a real file.
// The bundle is Track A's SAMPLE_MATTER_INVENTED_v3.json (sha12 f3c6f1e10c32, vendored byte for byte, pinned in sampleMatter.spec.ts); every paper opens with the line that says it is invented. Words: R1's MATTER_PAPERS_WORDS_FINAL (c2895699052b), by hash.
import bundle from "./fixtures/sample/SAMPLE_MATTER_INVENTED_v3.json";
import prefill from "./fixtures/sample/SAMPLE_PREFILL_INVENTED_v2.json";

export interface SamplePaper { name: string; text: string }
export const SAMPLE_PAPERS: readonly SamplePaper[] = bundle as SamplePaper[];

export const SAMPLE_TEXT = {
  button: "Load a sample matter", // 34d595ccdc53bee8
  note: "The sample matter is invented: an invented FIR, chargesheet extract, bail order and cheque memo, with no real parties.", // 85c10822f2eb8d7f
} as const;

// The sample prefill is Track A's SAMPLE_PREFILL_INVENTED_v2.json (sha12 71dc7af17823, byte for byte): B3 dates WITH their source labels, every one UNCONFIRMED (R1: the checklist's own line says dates you confirm), five bail facts with sides, one pasted citation line.
// Loaded together with the sample papers, never without them. R1's two lines are pinned by hash in sampleMatter.spec.ts.
export interface SampleDate { value: string; source: string }
export interface SampleFact { text: string; applicant: boolean }
export interface SamplePrefill { b3: Record<"cheque" | "presentation" | "memo" | "information" | "notice" | "receipt", SampleDate>; mode: string; facts: SampleFact[]; draftPaste: string }
const b3src = prefill.b3_s138_checklist;
const one = (x: { value: string; source: string }): SampleDate => ({ value: x.value, source: x.source });
export const SAMPLE_PREFILL: SamplePrefill = {
  b3: { cheque: one(b3src.cheque_date), presentation: one(b3src.presentations[0]), memo: one(b3src.return_memos[0]), information: one(b3src.information_received[0]), notice: one(b3src.notices[0]), receipt: one(b3src.notice_receipts[0]) },
  mode: b3src.notice_mode,
  facts: prefill.bail_facts.map((f) => ({ text: f.text, applicant: f.side === "applicant" })),
  draftPaste: prefill.draft_paste,
};

export const SAMPLE_PREFILL_TEXT = {
  line: "These values are filled in from the sample papers. Check each one against the papers before you use it.", // e90e8ac8e2b1a371 (R1, SAMPLE_PREFILL_AND_DATES_R1 7b307564a4b2)
  datesLine: "Some dates in these papers differ on purpose, so that you can see how conflicting dates appear in the chronology.", // 4659ab106742e3ae: shown only after a sample matter is loaded, beside the papers list, never inside the sample note
} as const;
