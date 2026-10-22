// The guide section "Access and the analysis models" (app#522; operator 22 Oct: in the user guide, with edits and redactions where needed). Words: R1 (ACCESS_GUIDE_522_R1_v2).
// This is the version that ships while cold start is OFF in the engine ("being tested": it says nothing works that does not). The ON version is a separate PR.
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
