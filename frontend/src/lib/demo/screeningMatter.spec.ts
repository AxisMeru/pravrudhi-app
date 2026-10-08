import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OFFENCES } from "../screening/offences";
import { MATTER_DOC_ID, MATTER_FILE_SHA256, MATTER_LENGTH, MATTER_OFFENCE_IDS, checkMatterText } from "./screeningMatter";

// The matter text itself is not in the repository. These tests check the checker with invented text, and the real file only when it is supplied.
test("the checker refuses any text but the accepted file: a wrong text, a line break, a changed length", () => {
  const invented = "x".repeat(MATTER_LENGTH);
  assert.ok(checkMatterText(invented).some((v) => /sha256/.test(v)));
  assert.ok(checkMatterText(`${invented.slice(0, 500)}\n${invented.slice(500)}`).some((v) => /not one paragraph/.test(v)));
  assert.ok(checkMatterText("short").some((v) => /characters/.test(v)));
  assert.equal(MATTER_FILE_SHA256.length, 64);
  assert.equal(MATTER_DOC_ID, "9e77f94d");
});

test("the matter's offences are ones the picker offers", () => {
  for (const id of MATTER_OFFENCE_IDS) assert.ok(OFFENCES.some((o) => o.id === id), id);
});

test("when SCREENING_MATTER_FILE is set, it is exactly the accepted file", { skip: !process.env.SCREENING_MATTER_FILE && "SCREENING_MATTER_FILE is not set (the text is not in the repository)" }, () => {
  const raw = readFileSync(process.env.SCREENING_MATTER_FILE as string, "utf8");
  assert.deepEqual(checkMatterText(raw), []);
});
