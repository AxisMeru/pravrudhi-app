// The guide section "Access and the analysis models" (app#522; operator 22 Oct: in the user guide, with edits and redactions where needed). Words: R1 (ACCESS_GUIDE_522_R1_v2).
// This is the ON version (d60 swap, R1 ACCESS_GUIDE_522_ON_R1): ships only with cold start ON in production AND every account that can sign in is allowed to start the models (the any-signed-in rule is live and read back; nothing is invited before then). If Run A/B fail and the flag goes OFF, this PR is not deployed (the OFF text, #525, is then the true one). If the flag goes back OFF, restore ACCESS_OFF. Deploy only after: flag ON read back, #509 live, the waker in live mode (R2).
// Redacted on purpose: no email, user id, endpoint id, dollar figure, limit, machine name or the helper that starts the models; no statement about who can create an account.
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

const ROW_PUBLIC = { label: "Without signing in", text: "You can read the public pages, watch the three films and use the anonymous demo. To screen your own facts you need to sign in." };
const ROW_ADMIN = { label: "Administrator", text: "An administrator can do everything a signed-in person can." };

export const ACCESS_OFF: AccessGuide = {
  ...COMMON,
  rows: [
    ROW_PUBLIC,
    { label: "Signed in", text: "You can do everything above, and use the workflows, Your matters, Matter tools and the old section look-up." },
    ROW_ADMIN,
  ],
  models: [
    `The analysis models are normally switched off. While they are off, a screening from a signed-in account is refused at once with this message: “${ACCESS_REFUSAL}” No result is shown.`,
    "Starting the models when a signed-in person asks for a screening is being tested. Until that test is finished and it is switched on, it does not start anything, and a screening from a signed-in account is refused as above.",
  ],
};

/** The ON version: ships with cold start ON and the any-signed-in rule applied. */
export const ACCESS_ON: AccessGuide = {
  ...COMMON,
  rows: [
    ROW_PUBLIC,
    { label: "Signed in", text: "You can do everything above, and use the workflows, Your matters, Matter tools and the old section look-up. Every signed-in person can use all of these, including starting the analysis models." },
    ROW_ADMIN,
  ],
  models: [
    "The analysis models are normally switched off. If you are signed in and send a screening while they are off, the app starts them and shows each model loading, one line for the first model and one for the second. This can take a few minutes. Nothing is shown as supported until both models have checked it.",
    "Even when both models have started, the second model may not complete its check for every ingredient. When that happens, the first model's result is shown with a warning, and any ingredient the second model did not check goes to a lawyer and is not shown as supported.",
    "If the models do not start, nothing is scored and no result is shown. You can try again in a few minutes.",
    "The models are switched off again after a period without use.",
  ],
};
