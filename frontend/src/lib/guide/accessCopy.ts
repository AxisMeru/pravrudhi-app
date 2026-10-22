// The guide section "Access and the analysis models" (app#522; operator 22 Oct: in the user guide, with edits and redactions where needed). R1 reads BOTH versions.
// ACCESS_OFF is what ships while cold start is OFF in the engine ("being tested": it says nothing works that does not). ACCESS_ON is the READY second version for the day cold start is switched on; it is NOT imported by the page
// (swapping is one import line in app/guide/page.tsx, with R1's re-read), and its words are pinned in accessCopy.spec.ts so they cannot drift unread.
// Redacted on purpose: no email, user id, endpoint id, dollar figure, limit, machine name or the helper that starts the models; no statement about who can create an account (R1 words that line if wanted).
export const ACCESS_REFUSAL = "The analysis models are switched off at the moment. Nothing was scored. Try again later."; // the app's own refusal line (signedStrings judges_offline, first two sentences + third), shown verbatim

export interface AccessGuide {
  heading: string;
  intro: string;
  rowsHeading: string;
  rows: ReadonlyArray<{ label: string; text: string }>;
  modelsHeading: string;
  models: readonly string[];
}

const COMMON = {
  heading: "Access and the analysis models",
  intro: "What you can do depends on whether you are signed in.",
  rowsHeading: "What you can do",
  modelsHeading: "How the analysis models start",
} as const;

const ROW_PUBLIC = { label: "Without signing in", text: "You can read the public pages and watch the three films. You can send a screening; while the analysis models are off it is refused at once and nothing is scored." };
const ROW_ADMIN = { label: "Administrator", text: "An administrator can do everything a signed-in person can, and also has the administrator screens." };

/** Ships while cold start is OFF. */
export const ACCESS_OFF: AccessGuide = {
  ...COMMON,
  rows: [
    ROW_PUBLIC,
    { label: "Signed in", text: "You can do everything above, and use the workflows, Your matters, Matter tools and the old section look-up. Every signed-in person can use everything, including starting the analysis models once that is switched on." },
    ROW_ADMIN,
  ],
  models: [
    `The analysis models are kept off except for checks. While they are off, a screening is refused at once with this message: “${ACCESS_REFUSAL}” No result is shown.`,
    "Starting the models when a person asks for a screening is being tested. Until that test is finished and it is switched on, it does not start anything for anyone, and a screening is refused as above.",
  ],
};

/** Ready for the day cold start is switched on (R1 reads it now; it is not shipped until then). */
export const ACCESS_ON: AccessGuide = {
  ...COMMON,
  rows: [
    ROW_PUBLIC,
    { label: "Signed in", text: "You can do everything above, and use the workflows, Your matters, Matter tools and the old section look-up. Every signed-in person can use everything, including starting the analysis models." },
    ROW_ADMIN,
  ],
  models: [
    "The analysis models are kept off when nobody needs them. If you are signed in and send a screening while they are off, the app starts them and shows each model loading, one line for the first model and one for the second. This can take a few minutes. Nothing is scored until both are ready.",
    `If you are not signed in, a screening is refused at once with this message: “${ACCESS_REFUSAL}”`,
    "If the second model does not start or does not finish its check, the first model's result is shown with a warning, no ingredient is shown as supported, and each ingredient the first model supported goes to a lawyer.",
    "The models switch off again by themselves after use.",
  ],
};
