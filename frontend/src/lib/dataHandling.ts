// The data-handling page (/data-handling): what leaves the firm, where it is processed, how long it is kept. Every sentence is R1's exact text (13 Oct 2026) or an
// existing signed constant quoted unchanged. Kept in ONE file so a late fact change is one edit. NOT said here, on purpose: any region for the smaller screening model,
// any location for the sign-in provider, "no fact text is kept" (a run record can carry the text of a supported fact), and any promise about how the models handle submissions
// (the code enforces none).
import { ASSISTANT_RETENTION_MAX_HOURS } from "./assistantContract";
import { ASSISTANT_ENTRY_ENABLED } from "./assistantFlag";
import { BANNER_STANDING_LINE } from "./screening/copy";
import { CITATION_RETENTION } from "./surfaceCopy";

export const DATA_HANDLING_TITLE = "Data handling";
export const DATA_HANDLING_SUBTITLE = "What leaves your firm when you use Pravrudhi-Nyaya, where it is processed, and how long it is kept.";

export interface DataHandlingSection {
  id: string;
  heading: string;
  paragraphs: string[];
  /** Phrases rendered as links; each is linked in the FIRST paragraph that contains it, so every paragraph carries at most one link. */
  links?: { text: string; href: string }[];
}

// The assistant route (#125; R1's exact words, 14 Oct; PROVISIONAL until Track C confirms on the API that the delete call really deletes the session and R2 has read it).
// The delete sentence says what WE do, never what Anthropic's systems end up holding; it ships only when ASSISTANT_DELETE_CONFIRMED is on. No retention period appears here.
// Set at build time (NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED=1) by L2A, in the same deploy as the entry flag, only after R2 has read the sweeper and the delete canary has passed. Off by default; no effect while the entry flag is off.
export const ASSISTANT_DELETE_CONFIRMED = process.env.NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED === "1";
export const DH_ASSISTANT_HEADING = "Screening with the assistant (optional)";
export const DH_NOASSIST = "Without the assistant, your facts are processed as described above and are not sent to Anthropic.";
export const DH_ASSIST_LINK_TEXT = "Anthropic's commercial terms";
export const DH_ASSIST_LINK_HREF = "https://www.anthropic.com/legal/commercial-terms";
export const DH_ASSIST_INTRO = `With the assistant, and only when you tick the consent box for that run, your facts are also sent to Anthropic through our account, under ${DH_ASSIST_LINK_TEXT}.`;
// About Anthropic's terms, not our own promise (R1 14 Oct). This exact string is the one sentence the promise scan exempts.
export const DH_ASSIST_TERMS = "Anthropic's commercial terms say it may not train models on customer content from its services.";
// Lead-2's final (Variant B, 14 Oct), R1's words. It says what WE do; it ships only with ASSISTANT_DELETE_CONFIRMED, i.e. once R2 has read the sweeper.
export const DH_ASSIST_DELETE = `When your screening finishes, we delete the assistant's session record from Anthropic's service. If that fails, we retry, and it is deleted within ${ASSISTANT_RETENTION_MAX_HOURS} hours at the latest.`;
export const DH_ASSIST_RETENTION_LINK_TEXT = "data retention policy";
export const DH_ASSIST_RETENTION_LINK_HREF = "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention";
// R1 14 Oct: about Anthropic's own policy, no period stated (none is true for this route). Checked by opening the URL once (14 Oct): it resolves and says Managed Agents session transcripts persist until the customer deletes them.
export const DH_ASSIST_RETENTION_ANTHROPIC = `Anthropic's own ${DH_ASSIST_RETENTION_LINK_TEXT} applies to any copy of your facts that it keeps.`;
export const DH_ASSIST_LAW = "Anthropic may keep content longer where the law requires it or to enforce its usage policy.";
export const DH_ASSIST_CONSENT = "The consent box is off for every run until you tick it.";
/** Also shown, as a short line, beside the assistant entry for an anonymous visitor in place of the consent box. Says "signed-in", nothing about how. */
export const DH_ASSIST_SIGNIN = "The assistant is offered only to signed-in users. Without signing in, you get the screening result without it.";

// R1's final sentence (Lead-2, 14 Oct): a fallback processing region is disclosed BEFORE it can take any traffic. Always shown: it is true whatever the assistant flags are.
export const DH_WHERE_FALLBACK = "If our EU processing is unavailable, part of the screening may instead run in a North American data centre for that request, and your facts are sent there. Retention is as described above; the hosting provider may keep its own logs.";

export const DH_WHERE_ASSIST = "If you use the assistant, Anthropic also processes your facts; see Screening with the assistant (optional).";

/** The page's sections. `assist` adds the assistant section and the "where it is processed" sentence for it (both behind the one assistant flag); `deleteConfirmed` adds the delete sentence. */
export function dataHandlingSections(assist: boolean, deleteConfirmed: boolean): readonly DataHandlingSection[] {
  return BASE_SECTIONS.flatMap((s): DataHandlingSection[] => {
    if (s.id === "assistant") return assist ? [{ ...s, paragraphs: s.paragraphs.filter((p) => deleteConfirmed || p !== DH_ASSIST_DELETE) }] : [];
    if (s.id === "where" && assist) return [{ ...s, paragraphs: [...s.paragraphs, DH_WHERE_ASSIST] }];
    return [s];
  });
}

const BASE_SECTIONS: readonly DataHandlingSection[] = [
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
    id: "assistant",
    heading: DH_ASSISTANT_HEADING,
    paragraphs: [DH_NOASSIST, DH_ASSIST_INTRO, DH_ASSIST_TERMS, DH_ASSIST_DELETE, DH_ASSIST_RETENTION_ANTHROPIC, DH_ASSIST_LAW, DH_ASSIST_CONSENT, DH_ASSIST_SIGNIN],
    links: [{ text: DH_ASSIST_LINK_TEXT, href: DH_ASSIST_LINK_HREF }, { text: DH_ASSIST_RETENTION_LINK_TEXT, href: DH_ASSIST_RETENTION_LINK_HREF }],
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
      "The screening runs on the Pravrudhi engine, hosted on RunPod (serverless, in an EU data centre). Parts of the screening run in EU data centres; for some parts the region is not fixed. " +
        "This app is hosted on Vercel, whose region is not fixed. Sign-in is handled by Supabase; we do not state where it is located. The hosting providers may keep their own logs.",
      DH_WHERE_FALLBACK,
    ],
  },
  {
    id: "browser",
    heading: "Stored in your browser",
    // Verified 13 Oct from the code. Only localStorage is used on the firm surface, with three keys: pravrudhi-auth-session (lib/auth.ts:21), pravrudhi.command-palette.recents
    // (lib/palette.ts:278) and pravrudhi-theme (lib/theme/theme.ts). The two notification flags (components/notifications/NotificationBell.tsx:15-16) are written only where canSeeNotifications(access, IS_DEMO) is true: the public demo, never a signed-in member; the run-page notes
    // (lib/annotations.ts) are Studio's. lib/dataHandling.spec.ts fails if any other storage key appears in src.
    paragraphs: [
      "For a signed-in member, your browser keeps your sign-in session, your recent pages in the command palette and your theme choice. The facts you type are not kept in your browser. The public demo also keeps your notification preferences.",
    ],
  },
  {
    id: "documents",
    heading: "Memo and run record",
    paragraphs: ["The memo and the run record are built in your browser from the result on your screen."],
  },
];

export const DATA_HANDLING_SECTIONS: readonly DataHandlingSection[] = dataHandlingSections(ASSISTANT_ENTRY_ENABLED, ASSISTANT_DELETE_CONFIRMED);

// P10 (R1, 14 Oct): a summary at the top and, with the assistant on, the two routes as labelled groups. Signed text only: the glance shows the FIRST signed paragraph of three sections
// verbatim with a link to each, the groups use the signed assistant lines, and the group "Without the assistant" sits BELOW the standard sections so "described above" (DH_NOASSIST) stays true.
export const DH_GLANCE_HEADING = "At a glance";
export const DH_GLANCE_LINE = "These are the first lines of the sections below; read the full section for the rest.";
export const DH_GLANCE_LINK = "See the full section";
export const DH_ROUTE_A_LABEL = "Without the assistant";
export const DH_ROUTE_B_LABEL = "With the assistant (only when you tick the consent box)";
/** The sections the glance quotes, in this order: what is sent, where it is processed, how long it is kept. */
export const DH_GLANCE_IDS = ["sent", "where", "kept"] as const;

export interface DataHandlingPage {
  glance: { heading: string; line: string; linkText: string; blocks: { id: string; heading: string; text: string; href: string }[] };
  /** The standard route's sections, in order (the assistant section is not among them). */
  standard: readonly DataHandlingSection[];
  /** Only with the assistant flag on: the section (heading kept, so the "where" sentence that names it stays true) holding the two labelled groups. */
  assistant?: { section: DataHandlingSection; groups: { label: string; paragraphs: string[] }[] };
}

export function dataHandlingPage(assist: boolean, deleteConfirmed: boolean): DataHandlingPage {
  const sections = dataHandlingSections(assist, deleteConfirmed);
  const standard = sections.filter((s) => s.id !== "assistant");
  const blocks = DH_GLANCE_IDS.map((id) => {
    const s = standard.find((x) => x.id === id)!;
    return { id, heading: s.heading, text: s.paragraphs[0], href: `#dh-${id}` };
  });
  const out: DataHandlingPage = { glance: { heading: DH_GLANCE_HEADING, line: DH_GLANCE_LINE, linkText: DH_GLANCE_LINK, blocks }, standard };
  const a = sections.find((s) => s.id === "assistant");
  if (a) out.assistant = { section: a, groups: [{ label: DH_ROUTE_A_LABEL, paragraphs: a.paragraphs.filter((p) => p === DH_NOASSIST) }, { label: DH_ROUTE_B_LABEL, paragraphs: a.paragraphs.filter((p) => p !== DH_NOASSIST) }] };
  return out;
}

export const DATA_HANDLING_PAGE: DataHandlingPage = dataHandlingPage(ASSISTANT_ENTRY_ENABLED, ASSISTANT_DELETE_CONFIRMED);

export const DATA_HANDLING_FOOTER = BANNER_STANDING_LINE;

/** localStorage keys that may appear on the firm surface; everything else in src must be one of OPERATOR_ONLY_KEYS or fail the test. */
export const FIRM_STORAGE_KEYS: readonly string[] = ["pravrudhi-auth-session", "pravrudhi.command-palette.recents", "pravrudhi-theme"];
