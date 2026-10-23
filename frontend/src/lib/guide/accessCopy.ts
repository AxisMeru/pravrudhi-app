// The guide section "Access and the analysis models" (app#522; operator 22 Oct: in the user guide, with edits and redactions where needed). Words: R1 (ACCESS_GUIDE_522_R1_v2).
// Standalone (Lead-2, 22 Oct: #525 closed unmerged). R1 22 Oct evening: the Signed in row and the first models paragraph are STATE-FREE (true before and after any-signed-in is live), so this text can ship in any of those states; the administrator row sentence about inviting by email is true only with #534 and its function live.
// Redacted on purpose: no email, user id, endpoint id, dollar figure, machine name or the helper that starts the models; no statement about who can create an account. LIMITS are allowed from 23 Oct (START_LIMITS below, Lead-2 and R1): only numbers read from their source; the daily spending cap is stated without its figure.

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
const ROW_ADMIN = { label: "Administrator", text: "An administrator can do everything a signed-in person can, and can invite a person by email." };

/** The ON version: ships with cold start ON and the any-signed-in rule applied. */
export const ACCESS_ON: AccessGuide = {
  ...COMMON,
  rows: [
    ROW_PUBLIC,
    { label: "Signed in", text: "You can do everything above, and use the workflows, Your matters, Matter tools and the old section look-up. Whether you can start the analysis models depends on your account." },
    ROW_ADMIN,
  ],
  models: [
    "The analysis models are normally switched off. If you send a screening while they are off and your account may start them, the app starts them and shows each model loading, one line for the first model and one for the second. This can take several minutes. Otherwise the page says they are switched off and nothing is scored. Nothing is shown as supported until both models have checked it.",
    "The second model may not start, or may not complete its check for every ingredient, even when the first model has. When that happens, the first model's result is shown with a warning, and any ingredient the second model did not check goes to a lawyer and is not shown as supported.",
    "If the first model does not start, the page says so plainly and no result is shown. You can try again later.",
    "The models can be switched off again after a period without use.",
  ],
};

/** app d66 (Lead-2, 23 Oct; words R1, GUIDE_START_LIMITS_R1_RULINGS_2026-10-23): the limits on starting the models. Only the 6 is a number: the engine's shipped configuration enforces it (cold_start_user_wakes_per_day), so it is stated "currently". The per-model daily limit, the wait after a failed start and the invitation limit are left out on purpose (box-side or administrator-only: they would go stale unseen); the daily spending limit has no figure. No dollar figure, no hours of service, no identifiers. */
export const START_LIMITS: { heading: string; items: readonly string[] } = {
  heading: "Starting the models: limits",
  items: [
    "Each account can start the analysis models only a limited number of times in any 24 hours (currently 6).",
    "Each model also has a daily limit on starts across all accounts.",
    "Starts stop for the rest of the day once a daily limit on their cost is reached.",
    "Each person can have one start under way at a time.",
    "After a failed start there is a short wait before another is allowed.",
    "After a period without use the models switch off again by themselves, so the first screening after that can wait several minutes.",
  ],
};
