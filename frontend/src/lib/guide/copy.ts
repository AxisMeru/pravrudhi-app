// Every user-visible string of the user guide (/guide) lives here, so R1 reads one list. The status names are imported from the Screening copy so
// the guide can never drift from the screen it describes. House-path rules: no "proof", "established" or "verbatim" about the house judges, "a fact
// that may defeat the claim" for a denial, "Not supported by these facts" for a missing ingredient, "quote" only about the opt-in frontier route
// (whose sentence is imported from the frontier files, not written here).
import { ABOUT_LINE, PRODUCT_LINE } from "../productCopy";
import { CITATIONS_PANEL_ENABLED } from "../citationNav";
import { OFFENCES, offenceLabel } from "../screening/offences";
import { BANNER_STANDING_LINE, CHIP_LABEL, DEFENCE_HEADING, DEFENCE_PROMPT_NOTE, EXPORT_GROUP_LABEL, EXPORT_LABELS, MEMO_DOCX_LABEL } from "../screening/copy";

export const GUIDE_PATH = "/guide";
export const GUIDE_NAV_LABEL = "User guide";
export const GUIDE_LANDING_LINK = "New here? Read the user guide.";
export const GUIDE_TITLE = "User guide";
export const GUIDE_SUBTITLE = "How to use Pravrudhi-Nyaya on a matter, what each status means, and what it does not do.";

export const GUIDE_SCREENSHOT_NOTE =
  "These screenshots were captured on a development stack, not on the live service. The screening input and the memo export use an invented matter; nothing on them is a real person or a real case. The ingredient checklist, the cited-fact row and the needs-your-review crop show a run on a public court order, used as an illustrative example; its output is not evidence.";

/** R1, 14 Oct: under frame 03, which shows a No fact cited row from a real run; it never calls the image an example of a supported row. */
export const GUIDE_CITED_FACT_CAPTION =
  "This row has no cited fact: the screening found no fact in your papers that supports this ingredient, so it asks you to look for one. When an ingredient is supported, its row names the fact it cites and shows that fact from your text.";

export interface GuideImage {
  file: string;
  alt: string;
  /** Shown under the image when the shot needs a standing condition (R1). */
  caption?: string;
}

// R1 (15 Oct): the frame-05 caption for a build WITH the citations panel. It is shown only with the retaken frame (see FRAME_05_RETAKEN below).
export const GUIDE_CITATIONS_CAPTION = "Preview: existence check only.";

// Frame 05 for the panel-on build must be retaken on a build with both citation flags on; until that file exists, the ON build shows step 6 with NO image and NO caption (never the old
// hosted-build frame). Studio/Track A flip this when the new 05-citations-panel.png is committed.
const FRAME_05_RETAKEN = false;

/** The six screenshots, in the order the guide uses them. Files live in frontend/public/guide/. */
export const GUIDE_IMAGES: Record<"input" | "checklist" | "citedFact" | "needsReview" | "citations" | "memo", GuideImage> = {
  input: {
    file: "01-screening-input.png",
    alt: "The top of the Screening page with an invented plot-sale matter: the standing not-legal-advice line, the caveat strip, the closed About this screening fold, the example entry naming two public court orders, and the facts form with the matter pasted in.",
  },
  checklist: {
    file: "02-ingredient-checklist.png",
    alt: "The result of a run on a public court order (High Court of Karnataka at Bengaluru, order of 25 March 2025, 2025:KHC:12773): the review agenda above the standing not-legal-advice line, then three ingredient rows under the heading To look for in your papers, each marked No fact cited with a What to check line.",
  },
  citedFact: {
    file: "03-cited-fact.png",
    alt: "One ingredient row from the same run on a public court order, marked No fact cited, with its What to check line.",
    caption: GUIDE_CITED_FACT_CAPTION,
  },
  needsReview: {
    file: "04-needs-your-review.png",
    alt: "One ingredient row marked Needs your review, with its plain reason and a What to check line; it asks you to check, it is not an error.",
  },
  citations: {
    file: "05-citations-panel.png",
    alt: "The Case citations panel: a preview label, a line saying how to enter one citation, an empty box and a Check citations button.",
    caption: GUIDE_CITATIONS_CAPTION,
  },
  memo: {
    file: "06-memo-export.png",
    alt: `The memo export group under the checklist, labelled "${EXPORT_GROUP_LABEL}", with ${EXPORT_LABELS.memo}, ${EXPORT_LABELS.print} and ${MEMO_DOCX_LABEL}, and the ${EXPORT_LABELS.runRecord} button beside it.`,
  },
};

export interface GuideStep {
  id: string;
  heading: string;
  text: string;
  image?: GuideImage;
}

export const GUIDE_INTRO_HEADING = "What Pravrudhi-Nyaya does";
export const GUIDE_INTRO = PRODUCT_LINE;
export const GUIDE_ABOUT_HEADING = "About the name";
export const GUIDE_ABOUT = ABOUT_LINE;

export const GUIDE_COVERED_HEADING = "Offences it covers";
/** The offences whose contracts are on the validated list, as the Screening page offers them (the two flagged not validated are left out). */
export const GUIDE_COVERED: string[] = OFFENCES.filter((o) => !o.notValidated).map(offenceLabel);
export const GUIDE_COVERED_NOTE = "Offences not on this list are referred back to you.";

export const GUIDE_BEFORE_HEADING = "Before you start";
export const GUIDE_BEFORE =
  "Do not enter real names or case details unless your firm's setup allows it. What leaves your firm, where it is processed and how long it is kept are set out on the Data handling page.";
export const GUIDE_BEFORE_LINK = "Read Data handling";

export const GUIDE_CITATIONS_OFF_TEXT =
  "A citation check is not offered in this version of the app. When it is offered, it will tell you whether we can match a citation to exactly one case in our index; it will not look at quotes, and it will not tell you whether a citation is real.";
export const GUIDE_LIMIT_CITATIONS_OFF =
  "The citation check is not offered in this version of the app. When it is offered, \u201cFound in our index\u201d will mean existence only, not that the case says what you cite it for, and \u201cNot found in our index\u201d will not show that a citation is not real.";
// R1's byte-exact text for a build WITH the citations panel (CITATIONS=1; both citation flags on). Neither contains "dev stack only" or "not served".
export const GUIDE_CITATIONS_ON_TEXT =
  "The citations panel below the checklist looks up one case citation that you enter in our index. It tells you whether we can match the citation to exactly one case in the index. It does not look at quotes, and it does not tell you whether the citation is real, because the index does not hold every judgment. The panel is labelled preview: existence check only.";
export const GUIDE_LIMIT_CITATIONS_ON =
  "The citation check looks the case up in our index from the citation alone and does not look at quotes. \u201cFound in our index\u201d is existence only, not a verification; \u201cNot found in our index\u201d does not show whether the citation is real, because the index does not hold every judgment.";

export const GUIDE_STEPS_HEADING = "Screening, step by step";
export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "paste",
    heading: "1. Paste the facts and pick the offence",
    text: "Paste the FIR, complaint or narrative on the Screening page and choose Split into numbered facts. Each fact becomes F1, F2 and so on, and you can edit any of them. Then pick the offence or offences to screen for. To see how it reads, choose Try an example from a public court order. Do not submit real names or case details unless your organisation allows it: the page shows the retention notice before you send.",
    image: GUIDE_IMAGES.input,
  },
  {
    id: "run",
    heading: "2. Screen the facts",
    text: "Choose Screen these facts. The first screening after a quiet period can take a few minutes to start (see If it seems slow). If it takes longer than usual, the page says so and, for a screening without the assistant, tries once more. You can cancel at any point.",
  },
  {
    id: "checklist",
    heading: "3. Read the ingredient checklist",
    text: "The checklist has one row for each ingredient of the offence. Each row carries a mark, a plain reason where one applies, and a line saying what to check. Each ingredient shows one of four marks: Supported by a fact, Suggested by the screening judge; check it, Needs your review, or No fact cited.",
    image: GUIDE_IMAGES.checklist,
  },
  {
    id: "cited",
    heading: "4. Check the cited fact",
    text: "When an ingredient is supported, the row names the fact it relies on, for example F1, and shows that fact in full from the text you submitted. Read it and decide whether you agree. The screening names the fact and the page shows that fact in full.",
    image: GUIDE_IMAGES.citedFact,
  },
  {
    id: "review",
    heading: "5. Work through what needs your review",
    text: "A row that needs your review is a prompt, not an error. The reason beside it says why, in plain words. Look at the facts for that ingredient yourself.",
    image: GUIDE_IMAGES.needsReview,
  },
  {
    id: "citations",
    heading: "6. Check citations",
    // R1 (15 Oct): on a build with no citations panel the guide says so (no frame 05, no dev-stack caption). The flags-on wording below is the interim text; R1's pre-signed
    // text for the CITATIONS=1 deploy replaces it at the flip.
    text: CITATIONS_PANEL_ENABLED ? GUIDE_CITATIONS_ON_TEXT : GUIDE_CITATIONS_OFF_TEXT,
    image: CITATIONS_PANEL_ENABLED && FRAME_05_RETAKEN ? GUIDE_IMAGES.citations : undefined,
  },
  {
    id: "export",
    heading: "7. Export the memo",
    text: "Under the checklist, the group Download the memo holds Markdown (.md), PDF and Word (.docx); Download run record (.json) is a separate button beside it. The memo carries the run, the versions and the standing line that this is a screening aid. The run record is a JSON file that includes the facts you entered, the full result that came back, the engine version and the checker version. Both are built in your browser and are saved to your device when you download them, so keep them as you would the matter file.",
    image: GUIDE_IMAGES.memo,
  },
];

export const GUIDE_STATUS_HEADING = "Reading the checklist";
export interface GuideStatus {
  label: string;
  meaning: string;
  note?: string;
}
export const GUIDE_STATUSES: GuideStatus[] = [
  {
    label: CHIP_LABEL.supported,
    meaning: "The screening points to a fact in your papers that may support this ingredient, and the page shows it. It is a suggestion to check, not a finding.",
  },
  {
    label: CHIP_LABEL.suggested,
    meaning: "A lighter signal from the screening. It is not a cited fact and it carries no probability. Treat it as a pointer to check.",
  },
  {
    label: CHIP_LABEL.not_supported,
    meaning: "No fact cited means the screening found no fact in your papers that supports this ingredient. It is a prompt to look for one, not a finding about your matter.",
  },
  {
    label: CHIP_LABEL.review,
    meaning: "The screening was unsure, a check was unavailable or did not confirm, the offence is not on the validated list, or the input was too long. It asks you to look; it is not an error.",
  },
  {
    label: DEFENCE_HEADING,
    meaning: "A fact that may defeat the claim, shown as a prompt for your review, not as a finding. It is not counted among the ingredients.",
    note: DEFENCE_PROMPT_NOTE,
  },
];
export const GUIDE_BANNER_TEXT =
  "On a result where no ingredient has a cited fact, a review agenda is shown first: what each ingredient needs, and which facts to look for. Nothing there is a finding about your matter. All ingredients supported is shown only when every ingredient is supported by a cited fact and the structure check passes. It never says the offence is made out.";

export const GUIDE_LIMITS_HEADING = "What it does not do";
export const GUIDE_LIMITS: string[] = [
  BANNER_STANDING_LINE,
  "The assistant reads only the facts you give it. A missing ingredient can mean the fact is not in your text.",
  CITATIONS_PANEL_ENABLED ? GUIDE_LIMIT_CITATIONS_ON : GUIDE_LIMIT_CITATIONS_OFF,
];

export const GUIDE_COLD_START_HEADING = "If it seems slow";
export const GUIDE_COLD_START =
  "The first screening after a quiet period can take a few minutes to start; a later one can be faster. The time varies; the page counts it, says so if it is slow, and you can cancel at any point.";

export const GUIDE_GLOSSARY_HEADING = "Glossary";
export const GUIDE_GLOSSARY: { term: string; meaning: string; note?: string }[] = [
  { term: "Ingredient", meaning: "one element the law requires for an offence, as the section lists it." },
  { term: "Referral", meaning: "the screening does not decide the point and hands it back to you." },
  { term: "Supported", meaning: "shown only where a cited fact appears to carry the ingredient; a suggestion for you to check, never a finding." },
  // R1's exact entry (13 Oct): "A fact that may defeat the claim: a fact in your papers that, if it holds, answers the claim (for example a defence); the screening shows it for your review and does not decide it."
  { term: DEFENCE_HEADING, meaning: "a fact in your papers that, if it holds, answers the claim (for example a defence); the screening shows it for your review and does not decide it.", note: DEFENCE_PROMPT_NOTE },
];
