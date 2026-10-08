// Signed wording for the statuses and service errors that the partner string table (the engine's docs/api/reason-codes.md) does not
// cover, WORD FOR WORD from the reviewed string note (fixtures/signedGapStrings.json carries its source and the file's sha256).
// Each says what the system did, never the fact. reasonStringsDrift.spec.ts compares every string below with that fixture, so the
// wording cannot drift; a string signed for a surface this app does not have yet (the citation-check codes, the API-key 401, the
// jobs 429) is kept in the fixture's named allow-list there, not here.

/** Element statuses: what each one means, shown under the status badge for the three that are not a verdict. */
export const ELEMENT_STATUS_EXPLANATION = {
  established: "The judge said this condition is shown and cites the supporting fact from your facts.",
  not_established: "The judge did not find this condition shown in your facts.",
  not_confirmed: "The judge leaned towards 'shown', but its confidence did not reach the level we require, so this condition is not counted as shown.",
  not_evaluated_second_unavailable: "The second judge did not answer, so this condition was not confirmed.",
  not_evaluated_gate1_unavailable: "This condition was not evaluated because the entailment check (a separate check of the cited fact against the claim) was unavailable.",
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

/** App-specific strings signed by R1 (6 Oct 2026; fixtures/appSignedStrings.json): the web session 401 and the memo disclaimer. */
export const SESSION_401_TEXT = "You are not signed in, or your session has ended. Nothing was scored. Sign in and try again.";
export const MEMO_DISCLAIMER_TEXT =
  "This memo is an analysis aid, not legal advice. A REFER_TO_LAWYER outcome is a referral, not an answer: the system reached no verdict, and a lawyer should look at the matter. The cited fact is verbatim text from the submitted facts, not proof that it is relevant.";

/**
 * Signed wording for the coded errors of pravrudhi #319 that THIS app surfaces (fixtures/codedErrorStrings.json: source note, head and
 * sha256). The others (checker_unavailable, registry_checker_unavailable, vendor_not_allowed) have no app surface: the admin-only Nyaya
 * pages show only the HTTP status. They are in the drift test's named allow-list.
 */
export const CODED_ERROR_TEXT = {
  agent_at_capacity: "The analysis service is busy, so nothing was scored. Try again in a few seconds.",
  agent_unavailable: "The analysis service is not available right now, so nothing was scored. Try again later.",
  chat_endpoint_unreachable: "The chat service could not be reached, so the reply could not be completed. Try again later.",
} as const;

/** Signed wording for the citation check's errors (fixtures/signedGapStrings.json: the reviewed string note, section 5; verify_at_capacity is R1's later replacement, fixtures/signedCitationAmendments.json), by the engine's coded 503 `error`. */
export const CITATION_ERROR_TEXT = {
  verify_timeout: "The citation check did not finish in time, so no result was returned. Try again later.",
  verify_at_capacity: "The citation check is busy, so no result was returned. Try again in about 5 seconds.",
  citation_index_unavailable: "The citation index is not available, so this citation was not checked.",
} as const;
