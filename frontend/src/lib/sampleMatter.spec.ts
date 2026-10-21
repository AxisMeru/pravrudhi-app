import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { SAMPLE_PAPERS, SAMPLE_TEXT } from "./sampleMatter";

const h16 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

test("the sample matter is Track A's invented bundle byte for byte (sha12 b5e5ccdbffaa): four papers, each opening with the line that says it is invented", () => {
  const file = readFileSync(join(__dirname, "fixtures", "sample", "SAMPLE_MATTER_INVENTED_v2.json"));
  assert.equal(createHash("sha256").update(file).digest("hex").slice(0, 12), "b5e5ccdbffaa");
  assert.deepEqual(SAMPLE_PAPERS.map((p) => p.name), ["FIR (invented sample)", "Chargesheet extract (invented sample)", "Bail order (invented sample)", "Cheque memo and notice (invented sample)"]);
  for (const p of SAMPLE_PAPERS) {
    assert.ok(p.text.startsWith("INVENTED SAMPLE PAPER FOR TESTING. Every name, number, date and place below is made up. It is not a real case."), p.name);
    assert.ok(p.text.length > 500 && p.text.length < 10_000_000, p.name);
  }
});

test("the button and its note are R1's words by hash (MATTER_PAPERS_WORDS_FINAL c2895699052b)", () => {
  assert.equal(h16(SAMPLE_TEXT.button), "34d595ccdc53bee8");
  assert.equal(h16(SAMPLE_TEXT.note), "85c10822f2eb8d7f");
  assert.doesNotMatch(`${SAMPLE_TEXT.button} ${SAMPLE_TEXT.note}`, /preview|accura|real case/i);
});

// R2's advise (#480): two repo guards (caseIdentifiers.spec.ts, noTrainingPromise.spec.ts) skip this whole directory, so it must hold exactly the pinned bundle: a later file here would escape both scans.
test("src/lib/fixtures/sample/ holds exactly the one pinned bundle file (the directory-wide guard exemptions cover nothing else)", () => {
  assert.deepEqual(readdirSync(join(__dirname, "fixtures", "sample")), ["SAMPLE_MATTER_INVENTED_v2.json"]);
});
