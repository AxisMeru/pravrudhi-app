import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { SAMPLE_PAPERS, SAMPLE_TEXT } from "./sampleMatter";

const h16 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

test("the sample matter is Track A's invented bundle byte for byte (sha12 ca52ffc05cea): four papers, each opening with the line that says it is invented", () => {
  const file = readFileSync(join(__dirname, "fixtures", "sample", "SAMPLE_MATTER_INVENTED_v5.json"));
  assert.equal(createHash("sha256").update(file).digest("hex").slice(0, 12), "ca52ffc05cea");
  assert.deepEqual(SAMPLE_PAPERS.map((p) => p.name), ["FIR (invented sample)", "Charge sheet extract (invented sample)", "Bail order (invented sample)", "Cheque return memo and legal notice (invented sample)"]);
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
test("src/lib/fixtures/sample/ holds exactly the two pinned files (the bundle and the prefill) (the directory-wide guard exemptions cover nothing else)", () => {
  assert.deepEqual(readdirSync(join(__dirname, "fixtures", "sample")).sort(), ["SAMPLE_MATTER_INVENTED_v5.json", "SAMPLE_PREFILL_INVENTED_v2.json"]);
});

// The sample prefill (Track A SAMPLE_PREFILL_INVENTED_v2, sha12 71dc7af17823): B3 dates with their source labels, ALL UNCONFIRMED (R1: the checklist counts from dates you confirm), five bail facts with sides, one draft paste; R1's two lines by hash.
import { SAMPLE_PREFILL, SAMPLE_PREFILL_TEXT } from "./sampleMatter";
test("the prefill is Track A's invented file byte for byte, every B3 date is unconfirmed with its source label, and R1's lines are pinned by hash", () => {
  const file = readFileSync(join(__dirname, "fixtures", "sample", "SAMPLE_PREFILL_INVENTED_v2.json"));
  assert.equal(createHash("sha256").update(file).digest("hex").slice(0, 12), "71dc7af17823");
  const raw = JSON.parse(file.toString("utf8")) as { b3_s138_checklist: Record<string, unknown> };
  const dates = [raw.b3_s138_checklist.cheque_date, ...(raw.b3_s138_checklist.presentations as unknown[]), ...(raw.b3_s138_checklist.return_memos as unknown[]), ...(raw.b3_s138_checklist.information_received as unknown[]), ...(raw.b3_s138_checklist.notices as unknown[]), ...(raw.b3_s138_checklist.notice_receipts as unknown[])] as Record<string, unknown>[];
  assert.equal(dates.length, 6);
  for (const d of dates) { assert.equal(d.confirmed, false, "no date is confirmed for the visitor"); assert.equal("confirmed_as" in d, false); }
  assert.deepEqual(Object.keys(SAMPLE_PREFILL.b3).sort(), ["cheque", "information", "memo", "notice", "presentation", "receipt"]);
  assert.deepEqual(Object.fromEntries(Object.entries(SAMPLE_PREFILL.b3).map(([k, v]) => [k, h16(v.source)])), { cheque: "7285495838a4e4e1", presentation: "0e021d2cabfdd30c", memo: "0e021d2cabfdd30c", information: "b1cd9e7625a198e6", notice: "4a15dc149654ce79", receipt: "b0b653f92072292d" }, "R1's five source labels by hash");
  assert.equal(SAMPLE_PREFILL.mode, "registered_post");
  assert.equal(SAMPLE_PREFILL.facts.length, 5);
  assert.deepEqual(SAMPLE_PREFILL.facts.map((f) => f.applicant), [true, true, true, true, false]);
  assert.equal(SAMPLE_PREFILL.draftPaste, "The applicant also refers to (2014) 8 SCC 273.");
  assert.equal(h16(SAMPLE_PREFILL_TEXT.line), "e90e8ac8e2b1a371");
  assert.equal(h16(SAMPLE_PREFILL_TEXT.datesLine), "4659ab106742e3ae");
});
test("the page fills the forms only from a loaded sample matter, sends each prefilled date with its source label and confirmed false, and keeps the dates line out of the sample note", () => {
  const page = readFileSync(join(__dirname, "..", "app", "matter-tools", "page.tsx"), "utf8");
  assert.match(page, /applyPrefill\(id\)/);
  assert.match(page, /source: b3src\[key\] \?\? "typed"/);
  assert.match(page, /\{ confirmed: false \}/);
  assert.match(page, /sampleOn && <p[^>]*data-testid="pv-sample-dates-line"/);
  assert.doesNotMatch(SAMPLE_TEXT.note, /differ on purpose/, "the note (85c10822f2eb8d7f) is on screen in the guide film and does not change");
});

// R2 advise on #493: the prefill goes away wherever the matter changes, not only at start and remove-all.
test("clearPrefill runs at every place the open matter is dropped or replaced: start, remove all, matterGone, refresh() finding the matter gone, opened from Your matters, deleted from Your matters", () => {
  const page = readFileSync(join(__dirname, "..", "app", "matter-tools", "page.tsx"), "utf8");
  assert.equal((page.match(/clearPrefill\(\)/g) ?? []).length, 6, "start, remove all, matterGone, refresh, onOpen, onDeleted");
  assert.match(page, /setPapers\(\[\]\); clearPrefill\(\); setMessage\(GONE_LINE\); \}\n  \}/, "refresh()'s 404 branch clears the prefill");
  assert.match(page, /setMessage\(GONE_LINE\);\s*return true/);
  assert.match(page, /clearResults\(\); clearPrefill\(\); setMessage\(GONE_LINE\)/);
  assert.match(page, /onOpen=\{\(id\) => \{[^}]*clearPrefill\(\)/);
  assert.match(page, /onDeleted=\{\(id\) => \{ if \(id === matter\) \{[^}]*clearPrefill\(\)/);
});
