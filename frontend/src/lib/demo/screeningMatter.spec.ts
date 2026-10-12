import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OFFENCES } from "../screening/offences";
import { MATTER_DOC_ID, MATTER_FILE_SHA256, MATTER_LENGTH, MATTER_OFFENCE_IDS, checkMatterText } from "./screeningMatter";

// The matter text itself is not in the repository. The checker is tested on INVENTED text with its own expectations, one condition at a time (so a mutant
// in any one condition is caught), and the real file is checked only when it is supplied.
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
const INVENTED = "Invented: a person is said to have promised something and not done it.";

test("the checker passes exactly the expected text, and each condition fails alone", () => {
  const ok = { sha256: sha(INVENTED), length: INVENTED.length };
  assert.deepEqual(checkMatterText(INVENTED, ok), []);
  // only the sha is wrong: same length, different text
  const sameLength = "X".repeat(INVENTED.length);
  assert.deepEqual(checkMatterText(sameLength, ok).map((v) => v.split(" ")[0]), ["sha256"]);
  // only the length is expected wrong: sha matches
  assert.deepEqual(checkMatterText(INVENTED, { sha256: sha(INVENTED), length: INVENTED.length + 1 }).map((v) => v.split(" ")[0]), ["the"]);
  assert.match(checkMatterText(INVENTED, { sha256: sha(INVENTED), length: INVENTED.length + 1 })[0], /characters/);
  // only the paragraph rule: sha and length both match a text that has a line break inside
  const twoLines = "Invented first part.\nInvented second part.";
  const v = checkMatterText(twoLines, { sha256: sha(twoLines), length: twoLines.length });
  assert.deepEqual(v, ["the text is not one paragraph"]);
  // a final newline is part of the file's sha and is trimmed for the length
  const withNewline = `${INVENTED}\n`;
  assert.deepEqual(checkMatterText(withNewline, { sha256: sha(withNewline), length: INVENTED.length }), []);
  assert.ok(checkMatterText(INVENTED, { sha256: sha(withNewline), length: INVENTED.length }).length === 1);
});

test("the real expectations are the accepted file's: 64 hex, 1,105 characters, doc id", () => {
  assert.match(MATTER_FILE_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(MATTER_LENGTH, 1105);
  assert.equal(MATTER_DOC_ID, "9e77f94d");
  assert.ok(checkMatterText("x".repeat(MATTER_LENGTH)).some((v) => /sha256/.test(v)));
  assert.ok(checkMatterText("short").some((v) => /characters/.test(v)));
});

test("the matter's offences are ones the picker offers", () => {
  for (const id of MATTER_OFFENCE_IDS) assert.ok(OFFENCES.some((o) => o.id === id), id);
});

test("when SCREENING_MATTER_FILE is set, it is exactly the accepted file", { skip: !process.env.SCREENING_MATTER_FILE && "SCREENING_MATTER_FILE is not set (the text is not in the repository)" }, () => {
  const raw = readFileSync(process.env.SCREENING_MATTER_FILE as string, "utf8");
  assert.deepEqual(checkMatterText(raw), []);
});
