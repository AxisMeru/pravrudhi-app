// One "check this citation" run, as a state the UI renders: no new statuses and no new wording. The engine's answer goes through
// `verifyView` (the five statuses shown verbatim, an unknown one flagged) and a failure through `classifyVerifyError` (the signed sentence for each
// coded refusal, including `citation_index_unavailable` as an honest "not checked" state), exactly as /citations does.

import { checkInputs, classifyVerifyError, verifyView, type VerifyErrorKind, type VerifyView } from "./citationCheck";

export type CitationCheckState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "result"; view: VerifyView; /** The engine's own coverage field when it sends one (shape not fixed yet), else undefined. */ coverage?: unknown }
  | { phase: "error"; kind: VerifyErrorKind; message: string }
  | { phase: "invalid"; message: string };

type Verify = (citation: string, quote: string, signal?: AbortSignal) => Promise<Parameters<typeof verifyView>[0] & { coverage?: unknown }>;

/** The final state of one run. Invalid input never calls the engine; a thrown error never leaves a half result. */
export async function runCitationCheck(verify: Verify, citation: string, quote: string, signal?: AbortSignal): Promise<CitationCheckState> {
  const check = checkInputs(citation, quote);
  if (!check.ok) return { phase: "invalid", message: check.message };
  try {
    const reply = await verify(citation, quote, signal);
    return { phase: "result", view: verifyView(reply), coverage: reply.coverage };
  } catch (e) {
    const { kind, message } = classifyVerifyError(e);
    return { phase: "error", kind, message };
  }
}
