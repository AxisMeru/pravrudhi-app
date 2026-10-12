// Every user-visible string of the user guide (/guide) lives here, so R1 reads one list. The status names are imported from the Screening copy so
// the guide can never drift from the screen it describes. House-path rules: no "proof", "established" or "verbatim" about the house judges, "a fact
// that may defeat the claim" for a denial, "Not supported by these facts" for a missing ingredient, "quote" only about the opt-in frontier route
// (whose sentence is imported from the frontier files, not written here).
import { FRONTIER_QUOTE_LIMIT_TEXT } from "../frontierReader";
import { BANNER_STANDING_LINE, CHIP_LABEL, DEFENCE_HEADING } from "../screening/copy";

export const GUIDE_PATH = "/guide";
export const GUIDE_NAV_LABEL = "User guide";
export const GUIDE_LANDING_LINK = "New here? Read the user guide.";
export const GUIDE_TITLE = "User guide";
export const GUIDE_SUBTITLE = "How to use the screening assistant, what each status means, and what it does not do.";

export const GUIDE_SCREENSHOT_NOTE =
  "The screens below were captured on the dev stack (local), engine 0.6.0, with invented matters. Nothing on them is a real person or a real case. They show how the screens read; they are not evidence about how well the assistant performs, and no accuracy claim is made.";

export interface GuideImage {
  file: string;
  alt: string;
}

/** The six screenshots, in the order the guide uses them. Files live in frontend/public/guide/. */
export const GUIDE_IMAGES: Record<"input" | "checklist" | "citedFact" | "needsReview" | "citations" | "memo", GuideImage> = {
  input: {
    file: "01-screening-input.png",
    alt: "The Screening page with an invented matter pasted and split into numbered facts F1 and F2, and the offence Cheating selected.",
  },
  checklist: {
    file: "02-ingredient-checklist.png",
    alt: "The ingredient checklist for the invented matter: one row per ingredient, each with a status chip, and the summary line above the standing not-legal-advice line.",
  },
  citedFact: {
    file: "03-cited-fact.png",
    alt: "One ingredient row marked Supported by a fact, with the cited fact F1 shown in full and a What to check line.",
  },
  needsReview: {
    file: "04-needs-your-review.png",
    alt: "An ingredient row marked Needs your review, with its plain reason; it asks you to check, it is not an error.",
  },
  citations: {
    file: "05-citations-panel.png",
    alt: "The citations panel below the checklist: a box to paste case citations, one per line, and a button to check them.",
  },
  memo: {
    file: "06-memo-export.png",
    alt: "The memo and audit-trail download buttons under the checklist.",
  },
};

export interface GuideStep {
  id: string;
  heading: string;
  text: string;
  image?: GuideImage;
}

export const GUIDE_INTRO_HEADING = "What this does";
export const GUIDE_INTRO =
  "The screening assistant reads the facts of a matter and shows, ingredient by ingredient, which parts of an alleged offence your facts support, which they do not, and what to check next. It refers a point to you whenever it is unsure. It is a screening aid for a lawyer. It does not decide anything.";

export const GUIDE_STEPS_HEADING = "How to use it";
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
    text: "Choose Screen these facts. The first analysis after the service has been idle can take a few minutes while the judges start. The page counts the time and says so if it is slow; you can cancel at any point.",
  },
  {
    id: "checklist",
    heading: "3. Read the ingredient checklist",
    text: "The checklist has one row for each ingredient of the offence. Each row carries a status chip, a plain reason where one applies, and a line saying what to check. The summary above it counts the ingredients that have a supporting fact and the ones that need your review.",
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
    text: "The citations panel below the checklist checks case citations you paste in against an index of Supreme Court judgments. It tells you whether a citation is in the index. It is not a finding that a citation is fake.",
    image: GUIDE_IMAGES.citations,
  },
  {
    id: "export",
    heading: "7. Export the memo",
    text: "Download the screening memo for your file, and the audit trail, which records what was sent and what came back. Both carry the run, the versions and the standing line that this is a screening aid.",
    image: GUIDE_IMAGES.memo,
  },
];

export const GUIDE_STATUS_HEADING = "What each status means";
export interface GuideStatus {
  label: string;
  meaning: string;
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
  },
];
export const GUIDE_BANNER_TEXT =
  "The summary line reads, for example, 1 of 3 ingredients have a supporting fact; 2 need your review. It says all ingredients are supported only when every ingredient is supported, both judges agree and the structure check passes. It never says the offence is made out.";

export const GUIDE_LIMITS_HEADING = "What it does not do";
export const GUIDE_LIMITS: string[] = [
  BANNER_STANDING_LINE,
  "The assistant reads only the facts you give it. A missing ingredient can mean the fact is not in your text.",
  "The citation check is not yet served in the hosted deployment. There the citations panel says the index is not available, and no citation is checked. Where it is served, a hit means only that the citation is in the index; it is not a check that the case says what you cite it for, and a miss does not show that a citation is not real.",
  FRONTIER_QUOTE_LIMIT_TEXT,
  "The frontier route is opt-in and off by default. When you switch it on, your facts are sent to the provider named at the toggle, under your organisation's key. It is advisory and never changes a status above it.",
];

export const GUIDE_COLD_START_HEADING = "If it seems slow";
export const GUIDE_COLD_START = "The first analysis after the service has been idle can take a few minutes while the judges start. Later ones are faster.";
