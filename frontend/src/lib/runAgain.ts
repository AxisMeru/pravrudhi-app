// "Run again" on the assisted route (Lead-2 decision 14 Oct; strings R1's, exactly). Offered only after the app's own 320 s timeout of an ASSISTED run,
// never automatically, never carrying the first run's consent: the consent line is shown again unticked and the button is enabled only once it is ticked
// (the facts go to the provider again, it is a new reservation and it counts toward the daily limit). Not offered for a finished or fallback result,
// and not enabled before RUN_AGAIN_MIN_SECONDS from the first submit.

export const RUN_AGAIN_LABEL = "Run again";
export const RUN_AGAIN_NOTE = "A second run counts toward your daily limit.";
export const RUN_AGAIN_MIN_SECONDS = 180;

export type RunAgainState = "hidden" | "waiting" | "offered";

/** `timedOut` is true only when the assisted request ended on the app's own timeout. `secondsSinceFirstSubmit` is measured from the first submit of that run. */
export function runAgainState(input: { assisted: boolean; timedOut: boolean; secondsSinceFirstSubmit: number }): RunAgainState {
  if (!input.assisted || !input.timedOut) return "hidden";
  return input.secondsSinceFirstSubmit >= RUN_AGAIN_MIN_SECONDS ? "offered" : "waiting";
}
