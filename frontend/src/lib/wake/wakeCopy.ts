// R1's words for cold start with progress (prabhasa-nyaya#1038, COLD_START_PROGRESS_WORDS fecdff374c72 + addendum d3f32e8b77f6). Pinned by hash in wakeCopy.spec.ts.
export const WAKE_GLOSS = "The first model reads each ingredient. The second model checks the same ingredients.";
export const WAKE_LABEL = { first: "First model", second: "Second model" } as const;
export const WAKE_STATUS = { waiting: "Waiting to start", starting: "Starting", ready: "Ready", failed: "Did not start" } as const;
export const WAKE_PROGRESS_ALL = "Starting the analysis models. Nothing has been scored yet. This can take a few minutes.";
export const WAKE_PROGRESS_FIRST_READY = "The first model is ready. Waiting for the second model. Nothing is shown as supported until both models have read each ingredient.";
export const WAKE_PROGRESS_SECOND_READY = "The second model is ready. Waiting for the first model. Nothing has been scored yet.";
export const WAKE_DONE_BOTH = "Both models are ready. Scoring now.";
export const WAKE_WARN_SECOND_FAILED = "The second model did not complete its check for at least one ingredient. The first model's result is shown. Any ingredient the second model did not check goes to a lawyer and is not shown as supported.";
export const WAKE_WARN_FIRST_FAILED = "The first model did not start. Nothing was scored, and no ingredient is shown as supported.";
export const WAKE_FAIL_BOTH = "The analysis models did not start. Nothing was scored and no result is shown. This is not a finding about your matter. You can try again in a few minutes.";
export const WAKE_FAIL_TIMEOUT_TAIL = "The models did not start within the time we allow.";
/** Poll errors (S10): R1's line, confirmed (hash 48532b162248a874). */
export const WAKE_POLL_ERROR = "We could not check whether the analysis models started. Nothing was scored and no result is shown. You can try again in a few minutes.";
/** Waking not allowed: the old line, exactly as today. */
export const WAKE_REFUSAL_KEEP = "The analysis models are switched off at the moment. Nothing was scored.";

/** The total-failure line; for a start-up time limit the tail goes before "You can try again". */
export function failBothLine(timeout: boolean): string {
  if (!timeout) return WAKE_FAIL_BOTH;
  const i = WAKE_FAIL_BOTH.indexOf(" You can try again");
  return `${WAKE_FAIL_BOTH.slice(0, i)} ${WAKE_FAIL_TIMEOUT_TAIL}${WAKE_FAIL_BOTH.slice(i)}`;
}
