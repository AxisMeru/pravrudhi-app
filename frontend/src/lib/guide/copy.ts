// Every user-visible string of the user guide (/guide) lives here, so R1 reads one list. The status names are imported from the Screening copy so
// the guide can never drift from the screen it describes. House-path rules: no "proof", "established" or "verbatim" about the house judges, "a fact
// that may defeat the claim" for a denial, "Not supported by these facts" for a missing ingredient, "quote" only about the opt-in frontier route
// (whose sentence is imported from the frontier files, not written here).
import { FRONTIER_QUOTE_LIMIT_TEXT } from "../frontierReader";
import { ABOUT_LINE, PRODUCT_LINE } from "../productCopy";
import { OFFENCES, offenceLabel } from "../screening/offences";
import { BANNER_STANDING_LINE, CHIP_LABEL, DEFENCE_HEADING, DEFENCE_PROMPT_NOTE, EXPORT_LABELS } from "../screening/copy";

export const GUIDE_PATH = "/guide";
export const GUIDE_NAV_LABEL = "User guide";
export const GUIDE_LANDING_LINK = "New here? Read the user guide.";
export const GUIDE_TITLE = "User guide";
export const GUIDE_SUBTITLE = "How to use Pravrudhi-Nyaya on a matter, what each status means, and what it does not do.";

export const GUIDE_SCREENSHOT_NOTE =
  "The screens below were captured on the dev stack (local), engine 0.6.0, with invented matters. Nothing on them is a real person or a real case. They show how the screens read, not how the assistant will do on your matter.";

export interface GuideImage {
  file: string;
  alt: string;
  /** Shown under the image when the shot needs a standing condition (R1). */
  caption?: string;
}

export const GUIDE_CITATIONS_CAPTION = "Dev stack only: the citation check is not yet served in the hosted deployment.";

/** The six screenshots, in the order the guide uses them. Files live in frontend/public/guide/. */
export const GUIDE_IMAGES: Record<"input" | "checklist" | "citedFact" | "needsReview" | "citations" | "memo", GuideImage> = {
  input: {
    file: "01-screening-input.png",
    alt: "The Screening page after Split into numbered facts: an invented plot-sale matter split into six numbered facts F1 to F6, with the offence Cheating (BNS 318 · IPC 415) ticked, and the opt-in frontier toggle and its stated limit below.",
  },
  checklist: {
    file: "02-ingredient-checklist.png",
    alt: "The result for the invented plot-sale matter: the summary saying that none of the three ingredients is supported by a fact, two are suggested by the screening judge (check it) and one is not supported by these facts, above the standing not-legal-advice line, then three ingredient rows (two marked Suggested by the screening judge; check it, one marked Not supported by these facts), each with a What to check line, and the empty Case citations panel below.",
  },
  citedFact: {
    file: "03-cited-fact.png",
    alt: "One ingredient row marked Supported by a fact, naming fact F1 and showing that fact in full (an invented jewellery matter).",
  },
  needsReview: {
    file: "04-needs-your-review.png",
    alt: "One ingredient row marked Needs your review, with its plain reason and a What to check line; it asks you to check, it is not an error.",
  },
  citations: {
    file: "05-citations-panel.png",
    alt: `The empty Case citations panel: a preview label, a line saying how to enter citations, an empty box and a Check citations button. ${GUIDE_CITATIONS_CAPTION}`,
    caption: GUIDE_CITATIONS_CAPTION,
  },
  memo: {
    file: "06-memo-export.png",
    alt: `The three export buttons under the checklist: ${EXPORT_LABELS.memo}, ${EXPORT_LABELS.print} and ${EXPORT_LABELS.runRecord}.`,
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

export const GUIDE_STEPS_HEADING = "Screening, step by step";
export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "paste",
    heading: "1. Paste the facts and pick the offence",
    text: "Paste the FIR, complaint or narrative on the Screening page and choose Split into numbered facts. Each fact becomes F1, F2 and so on, and you can edit any of them. Then pick the offence or offences to screen for. Do not submit real names or case details unless your organisation allows it: the page shows the retention notice before you send.",
    image: GUIDE_IMAGES.input,
  },
  {
    id: "run",
    heading: "2. Screen the facts",
    text: "Choose Screen these facts. The first analysis after idle can take a few minutes while the judges start (see If it seems slow). The page counts the time and says so if it is slow; you can cancel at any point.",
  },
  {
    id: "checklist",
    heading: "3. Read the ingredient checklist",
    text: "The checklist has one row for each ingredient of the offence. Each row carries a status chip, a plain reason where one applies, and a line saying what to check. The summary above it counts the rows in each state that applies: supported by a fact, suggested by the screening judge, needing your review, not supported by these facts, and facts that may defeat the claim.",
    image: GUIDE_IMAGES.checklist,
  },
  {
    id: "cited",
    heading: "4. Check the cited fact",
    text: "When an ingredient is supported, the row names the fact it relies on, for example F1, and shows that fact in full from the text you submitted. Read it and decide whether you agree. The assistant names the fact; it does not pick words out of it.",
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
    text: "The citations panel below the checklist checks case citations you paste in against an index of Supreme Court judgments. It tells you whether a citation is in the index. It does not tell you whether a citation is genuine. The panel is dev stack only: it is not served in the hosted deployment.",
    image: GUIDE_IMAGES.citations,
  },
  {
    id: "export",
    heading: "7. Export the memo",
    text: "Download the screening memo for your file, and the run record. The memo carries the run, the versions and the standing line that this is a screening aid. The run record is a JSON file that includes the facts you entered, the full result that came back, the engine version and the checker version. Both files are built in your browser and are saved to your device when you download them, so keep them as you would the matter file.",
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
    meaning: "A screening judge points to a fact in your facts that may support this ingredient, and the page shows it. It is a suggestion to check, not a finding.",
  },
  {
    label: CHIP_LABEL.suggested,
    meaning: "A lighter signal from the screening judge. It is not a cited fact and it carries no probability. Treat it as a pointer to check.",
  },
  {
    label: CHIP_LABEL.not_supported,
    meaning: "The judge did not find this ingredient in the facts you gave. It may sit in a fact you did not include.",
  },
  {
    label: CHIP_LABEL.review,
    meaning: "The judge was unsure, the two judges disagreed, the offence is not on the validated list, or the input was too long. It asks you to look; it is never an error.",
  },
  {
    label: DEFENCE_HEADING,
    meaning: "A fact the judge found that may weaken the claim. It is shown for you to weigh and is not counted among the ingredients.",
    note: DEFENCE_PROMPT_NOTE,
  },
];
export const GUIDE_BANNER_TEXT =
  "The summary line can read, for example, that none of the three ingredients is supported by a fact, two are suggested by the screening judge (check it) and one is not supported by these facts. It says all ingredients are supported only when every ingredient is supported, both judges agree and the structure check passes. It never says the offence is made out.";

export const GUIDE_LIMITS_HEADING = "What it does not do";
export const GUIDE_LIMITS: string[] = [
  BANNER_STANDING_LINE,
  "The assistant reads only the facts you give it. A missing ingredient can mean the fact is not in your text.",
  "The citation check is dev stack only; it is not served in the hosted deployment. There the citations panel says the index is not available, and no citation is checked. Where it is served, a hit means only that the citation is in the index; it is not a check that the case says what you cite it for, and a miss does not show that a citation is not real.",
  FRONTIER_QUOTE_LIMIT_TEXT,
  "The frontier route is opt-in and off by default. When you switch it on, your facts are sent to the provider named at the toggle, under your organisation's key. It is advisory and never changes a status above it.",
];

export const GUIDE_COLD_START_HEADING = "If it seems slow";
export const GUIDE_COLD_START =
  "The first analysis after idle can take a few minutes while the judges start; a later one can be faster. The time varies; the page counts it, says so if it is slow, and you can cancel at any point.";

export const GUIDE_GLOSSARY_HEADING = "Glossary";
export const GUIDE_GLOSSARY: { term: string; meaning: string; note?: string }[] = [
  { term: "Ingredient", meaning: "one element the law requires for an offence, as the section lists it." },
  { term: "Referral", meaning: "the screening does not decide the point and hands it back to you." },
  { term: "Supported", meaning: "shown only where a cited fact appears to carry the ingredient; a suggestion for you to check, never a finding." },
  // R1's exact entry (13 Oct): "A fact that may defeat the claim: a fact in your papers that, if it holds, answers the claim (for example a defence); the screening shows it for your review and does not decide it."
  { term: DEFENCE_HEADING, meaning: "a fact in your papers that, if it holds, answers the claim (for example a defence); the screening shows it for your review and does not decide it.", note: DEFENCE_PROMPT_NOTE },
];
