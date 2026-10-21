// The one-click INVENTED sample matter on /matter-tools (Lead-2 P0, 20 Oct): four invented papers (an FIR, a chargesheet extract, a bail order, a cheque memo and notice) so a visitor, and the deploy gate, can run every tool without a real file.
// The bundle is Track A's SAMPLE_MATTER_INVENTED_v3.json (sha12 f3c6f1e10c32, vendored byte for byte, pinned in sampleMatter.spec.ts); every paper opens with the line that says it is invented. Words: R1's MATTER_PAPERS_WORDS_FINAL (c2895699052b), by hash.
import bundle from "./fixtures/sample/SAMPLE_MATTER_INVENTED_v3.json";

export interface SamplePaper { name: string; text: string }
export const SAMPLE_PAPERS: readonly SamplePaper[] = bundle as SamplePaper[];

export const SAMPLE_TEXT = {
  button: "Load a sample matter", // 34d595ccdc53bee8
  note: "The sample matter is invented: an invented FIR, chargesheet extract, bail order and cheque memo, with no real parties.", // 85c10822f2eb8d7f
} as const;
