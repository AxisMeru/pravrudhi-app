// The guide section "Access and the analysis models" (app#522; operator 22 Oct: in the user guide, with edits and redactions where needed). Words: R1 (ACCESS_GUIDE_522_R1_v2).
// Standalone (Lead-2, 22 Oct: #525 closed unmerged). Ships ONLY with cold start ON in production AND every account that can sign in allowed to start the models (the any-signed-in rule live and read back; nothing invited before then), #509 live and the waker in live mode (R2). If the flag goes back OFF, take this section out (git revert of the deploy PR) rather than restore other text. R1 reads it with the flag roll.
// Redacted on purpose: no email, user id, endpoint id, dollar figure, limit, machine name or the helper that starts the models; no statement about who can create an account.

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
    "If a model does not start, the page says so plainly. Nothing is shown as supported that both models did not check. You can try again in a few minutes.",
    "The models can be switched off again after a period without use.",
  ],
};
