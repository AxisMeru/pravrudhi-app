import { YM_NOTE } from "./yourMatters";
// The matter note and the 'matter gone' line of the matter-tools page. 20 Oct (pravrudhi-app#478): R1's MATTER_PAPERS_WORDS_FINAL (v5, sha12 c2895699052b, option A interim after Lead-2's ruling; from L2A's STORE_FACTS_MATTER_PAPERS a804f4e09c07), by hash in previewMatterNote.spec.ts. Papers are kept on the engine's network volume (EU-RO) until the visitor deletes them; the old 17 Oct container-local wording is gone.
export const MATTER_NOTE = {
  /** Signed out, or any state where the list is not shown (R1, 22 Oct, MATTER_NOTE_SIGNED_OUT_R1 hash 8bb3053cf8c7acdc; the v3 sentences "Keep the matter number ... cannot be listed here" are gone: false once the list exists). */
  matter_note: "The papers you add here are kept as text in our store, in the EU (Romania), until you delete the paper or the matter. When you are signed in, Your matters lists your matters, and you can open or delete them there. Deleting removes them from this service's store. Images are not read.",
  /** Replaces the \"Images are not read.\" sentence only once scanned papers are on (NEXT_PUBLIC_SCANNED_INTAKE=1) in production AND tested end to end (R1): until then the note says images are not read. */
  matter_note_images: "For a scanned paper, only the text read from its pages is kept; the page images are not written to our store.",
  /** With the list on (NEXT_PUBLIC_YOUR_MATTERS=1), R1 ym_note (559d274110ed22e2) replaces matter_note; the scanned-paper sentence swap applies the same way. */
  matter_note_list: YM_NOTE,
  matter_gone: "This matter is no longer held. Start a matter and add the papers again.",
} as const;
