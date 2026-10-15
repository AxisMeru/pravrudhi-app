import { MEMO_DISCLAIMER_TEXT } from "./signedStrings";

// The memo disclaimer (R1-signed, lib/signedStrings.ts). The memo itself is built by lib/screening/memo.ts (buildScreeningMemo): the Screening page and the Matters page both use it.
// The legacy Matters builder that lived here (buildMemo: "Engine reason code", headings by raw contract id, the provision-text blocks) was removed in #214 once nothing used it.
export const MEMO_DISCLAIMER = MEMO_DISCLAIMER_TEXT;
