// The accepted Screening E2E matter (Lead-2, 8 Oct): the allegation paragraph of a public Madras High Court order. The TEXT is NOT in this repository (the
// repository is public and carries no real-person identifiers): the live spec reads it at run time from SCREENING_MATTER_FILE, and this module holds only
// what is needed to check that the right text was supplied: its expected sha256, its length, the offences it invokes and the caveat to record.
export const MATTER_DOC_ID = "9e77f94d";
/** sha256 of the file exactly as handed over (final newline included). */
export const MATTER_FILE_SHA256 = "f585f16b7dec4eeb35df9b2e8c25f03f1baf717f10bd021e4d3086b2a576e6bc";
/** Length of the submitted fact: the file's text, trimmed. */
export const MATTER_LENGTH = 1105;
/** The offences the matter invokes (IPC 406 and 420; 506(i) is not a validated contract). */
export const MATTER_OFFENCE_IDS: readonly string[] = ["breach-of-trust", "cheating"];
export const MATTER_CAVEAT = "the extraction pipeline touched it; no train/eval/dev/bank file holds it";
export const MATTER_NOT_SCREENED = "IPC 506(i) is not one of the validated contracts";

import { createHash } from "node:crypto";

/** Violations of the supplied matter text: empty when it is exactly the accepted file. */
export function checkMatterText(raw: string): string[] {
  const out: string[] = [];
  const sha = createHash("sha256").update(raw, "utf8").digest("hex");
  if (sha !== MATTER_FILE_SHA256) out.push(`sha256 ${sha} is not the accepted ${MATTER_FILE_SHA256}`);
  const text = raw.trim();
  if (text.length !== MATTER_LENGTH) out.push(`the trimmed text is ${text.length} characters, expected ${MATTER_LENGTH}`);
  if (/\n/.test(text)) out.push("the text is not one paragraph");
  return out;
}
