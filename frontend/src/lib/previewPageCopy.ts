// The app-side labels of the preview-workflow page (/preview), R1's file PREVIEW_PAGE_STRINGS_R1_2026-10-17.md (sha12 58bc09189bb7), pinned key by key in previewPageCopy.spec.ts; the engine's own sentences are shown as it sends them.
export const PREVIEW_PAGE = {
  title: "Matter tools",
  matterHeading: "Papers for a matter",
  startMatter: "Start a matter",
  matterStarted: "A matter is started. Add the papers you want it to hold.",
  paperNameLabel: "Name of the paper",
  paperTextLabel: "Paste the text of the paper",
  addPaper: "Add the paper",
  papersHeading: "Papers added",
  removePaper: "Remove",
  removeAll: "Remove all the papers and the matter",
  // R1 (WEB_UX_POLISH_R1_ANSWERS fe5051df8a55): the two-step confirm, built on the signed Your-matters wording; the starting button above keeps its signed text
  removeAllQuestion: "Remove all the papers and the matter? They are removed from this service's store. This cannot be undone.", // dbbb42544bbeb438
  removeAllYes: "Yes, remove all", // fac76e76b4216f9c
  removeAllCancel: "Cancel", // 19766ed6ccb2f4a3 (the signed ym_cancel)
  s3Name: "Quashing agenda",
  s3Line: "Lists the categories the Supreme Court gave for quashing an FIR or complaint, and the papers you added. It does not say whether any category applies.",
  s3Run: "Make the quashing agenda",
  working: "Working",
  signedOutLine: "Sign in to add papers and use these tools.",
  sessionUnverified: "We could not check your sign-in. Reload the page to try again.", // bc8e6c589eb7bc03 (R1 21 Oct, #499): a failed or timed-out identity check offers nothing and says only this
  signedOutSample: "After you sign in, you can try the tools on a sample matter.", // R1 21 Oct (TOOL_OFF_LINES_R1 27fd5ce28704, 511c43e85a780657): states a fact; the button is not on the page signed-out
  signedOutLink: "Sign in",
  signed401: "Sign in to add papers.",
  toolsOffLine: "Some tools on this page are not switched on in this deployment. A tool that is off says so when you use it.",
} as const;
