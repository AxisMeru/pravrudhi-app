// The data-handling page (/data-handling): what leaves the firm, where it is processed, how long it is kept. Every sentence is R1's exact text (13 Oct 2026) or an
// existing signed constant quoted unchanged. Kept in ONE file so a late fact change is one edit. NOT said here, on purpose: any region for the smaller screening model,
// any location for the sign-in provider, "no fact text is kept" (a run record can carry the text of a supported fact), and "never used for training or evaluation"
// (a promise the code does not enforce).
import { FRONTIER_TOGGLE_LABEL, FRONTIER_UNAVAILABLE_TEXT } from "./frontierReader";
import { BANNER_STANDING_LINE } from "./screening/copy";
import { CITATION_RETENTION } from "./surfaceCopy";

export const DATA_HANDLING_TITLE = "Data handling";
export const DATA_HANDLING_SUBTITLE = "What leaves your firm when you use Pravrudhi-Nyaya, where it is processed, and how long it is kept.";

export interface DataHandlingSection {
  id: string;
  heading: string;
  paragraphs: string[];
}

export const DATA_HANDLING_SECTIONS: readonly DataHandlingSection[] = [
  {
    id: "sent",
    heading: "What is sent",
    paragraphs: [
      "When you press Screen these facts, the facts you enter and the offences you select are sent to the Pravrudhi engine.",
      // Confirmed from the code (13 Oct): txt is read with file.text() (lib/factsInput.ts:84-85), pdf with pdfjs and docx with mammoth in a Web Worker, all in the browser
      // (lib/docParsers.ts:11-12, lib/docx.worker.ts:14-15); no upload, FormData or network call in that path.
      "Files you choose are read in your browser; only the text read from them is sent.",
    ],
  },
  {
    id: "citations",
    heading: "Citation check",
    paragraphs: [CITATION_RETENTION],
  },
  {
    id: "kept",
    heading: "How long it is kept",
    paragraphs: [
      "Run records are kept for up to 7 days. They are removed when the next analysis runs, and can disappear earlier if the service restarts. Signed-in and anonymous runs are kept the same way. " +
        "A run record can include the text of facts the screening marked as supported, so do not enter real names or case details unless your firm's setup allows it. " +
        "Partner audit records hold no fact text and are kept for up to 90 days. Requests that run asynchronously are held in memory for about an hour.",
    ],
  },
  {
    id: "where",
    heading: "Where it is processed",
    paragraphs: [
      "The screening runs on the Pravrudhi engine, hosted on RunPod (serverless, in an EU data centre). The larger of the two screening models runs in EU data centres; the region of the other is not fixed. " +
        "This app is hosted on Vercel, whose region is not fixed. Sign-in is handled by Supabase; its location is not stated here. The hosting providers may keep their own logs.",
    ],
  },
  {
    id: "frontier",
    heading: "Frontier route",
    // The existing toggle text, exactly (lib/frontierReader.ts): a label and, where the deployment has not switched it on, the reason it is unavailable.
    paragraphs: [`${FRONTIER_TOGGLE_LABEL}. ${FRONTIER_UNAVAILABLE_TEXT}`],
  },
  {
    id: "browser",
    heading: "Stored in your browser",
    // Verified 13 Oct from the code. Only localStorage is used on the firm surface, with three keys: pravrudhi-auth-session (lib/auth.ts:21), pravrudhi.command-palette.recents
    // (lib/palette.ts:278) and pravrudhi-theme (lib/theme/theme.ts). The notification flags (components/notifications/NotificationBell.tsx:15-16) are operator-only and the run-page notes
    // (lib/annotations.ts) are Studio's. lib/dataHandling.spec.ts fails if any other storage key appears in src.
    paragraphs: [
      "On these screens your browser keeps your sign-in session, your recent pages in the command palette and your theme choice. The facts you type are not kept in your browser.",
    ],
  },
  {
    id: "documents",
    heading: "Memo and run record",
    paragraphs: ["The memo and the run record are built in your browser from the result on your screen."],
  },
];

export const DATA_HANDLING_FOOTER = BANNER_STANDING_LINE;

/** localStorage keys that may appear on the firm surface; everything else in src must be one of OPERATOR_ONLY_KEYS or fail the test. */
export const FIRM_STORAGE_KEYS: readonly string[] = ["pravrudhi-auth-session", "pravrudhi.command-palette.recents", "pravrudhi-theme"];
