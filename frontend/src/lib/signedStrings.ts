// Signed wording for the statuses and service errors that the partner string table (the engine's docs/api/reason-codes.md) does not
// cover, WORD FOR WORD from the reviewed string note (fixtures/signedGapStrings.json carries its source and the file's sha256).
// Each says what the system did, never the fact. reasonStringsDrift.spec.ts compares every string below with that fixture, so the
// wording cannot drift; a string signed for a surface this app does not have yet (the citation-check codes, the API-key 401, the
// jobs 429) is kept in the fixture's named allow-list there, not here.

/** Element statuses: what each one means, shown under the status badge for the three that are not a verdict. */
export const ELEMENT_STATUS_EXPLANATION = {
  established: "The judge said this condition is shown and quoted words from your facts that passed the quote check.",
  not_established: "The judge did not find this condition shown in your facts.",
  not_confirmed: "The judge leaned towards 'shown', but its confidence did not reach the level we require, so this condition is not counted as shown.",
  not_evaluated_second_unavailable: "The second judge did not answer, so this condition was not confirmed.",
  not_evaluated_gate1_unavailable: "This condition was not evaluated because the entailment check (a separate check of the quoted words against the claim) was unavailable.",
} as const;

/** Service errors, by the engine's coded 503 `error` (and 429). */
export const SERVICE_ERROR_TEXT = {
  judges_offline: "The analysis models are switched off at the moment. Nothing was scored. Try again later.",
  judges_warming: "The analysis models may still be starting up. Nothing was scored. Try again after the number of seconds shown.",
  judge_unavailable: "The analysis models are not available right now. Nothing was scored. Try again later.",
  outside_service_window: "The service is outside its service hours. Nothing was scored.",
  service_config_missing: "The service is not fully set up. Nothing was scored.",
  rate_limited: "Too many requests. Wait the number of seconds shown before trying again. Nothing was scored.",
} as const;
