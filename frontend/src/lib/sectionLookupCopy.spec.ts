import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { SECTION_LOOKUP_COPY } from "./sectionLookupCopy";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  heading: "6d86b06c3a340542",
  codeLegend: "930800fa9d0c3b64",
  codeIpc: "331b8ee48fd11af7",
  codeCrpc: "df278f5a0249d8fe",
  sectionLabel: "0ac1066939537a70",
  button: "504101bcda9ef600",
  badSection: "2b2b36e1890f75cf",
  unavailable: "c73ffc6e8de35c19",
  retry: "83344dbc3a52da5e",
};

test("the Section look-up words are R1's, by hash (SECTION_LOOKUP_APP_WORDS 17577bb035ff)", () => {
  assert.deepEqual(Object.keys(SECTION_LOOKUP_COPY).sort(), Object.keys(PINS).sort());
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h((SECTION_LOOKUP_COPY as Record<string, string>)[k]), hash, k);
});
