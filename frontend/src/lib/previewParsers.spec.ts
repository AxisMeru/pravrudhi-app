import assert from "node:assert/strict";
import test from "node:test";

import a1 from "./fixtures/preview/a1_draft_citation_check.json";
import a3 from "./fixtures/preview/a3_chronology.json";
import a5 from "./fixtures/preview/a5_review_agenda.json";
import s1 from "./fixtures/preview/s1_matter_citation_sweep.json";
import { parseA1, parseA3, parseA5, parseS1 } from "./previewParsers";

// Track A's sample responses (real engine functions, invented text; trackA/preview/samples, shas in the file notes). The page may show only what these readers keep.
const body = (s: { response: unknown }) => s.response as Record<string, unknown>;

test("A3: the ambiguous row shows BOTH readings, the paper's own words and the source; custody days are never read", () => {
  const v = parseA3(body(a3))!;
  assert.ok(v.sections.length >= 2);
  const amb = v.sections.find((s) => s.key === "ambiguous")!;
  assert.deepEqual(amb.rows[0].readings, ["2024-06-12", "2024-12-06"]);
  assert.equal(amb.rows[0].dateAsWritten, "12.06.2024");
  assert.match(amb.rows[0].quote ?? "", /The accused was arrested on 12\.06\.2024/);
  assert.match(amb.rows[0].source ?? "", /chronology-note-B, p\. 1/);
  const json = JSON.stringify(v);
  assert.ok(!/cannot say yet|custody_days|span_sha256|cue_word/.test(json), "no custody days and no internal fields");
  assert.equal(v.headers.date, "Date as written, and how we read it");
});

test("A3: every event row of the sample is kept in the engine's order", () => {
  const events = parseA3(body(a3))!.sections.find((s) => s.key === "events")!.rows;
  assert.equal(events.length, (body(a3).events as unknown[]).length);
  assert.equal(events[0].dateAsWritten, "1 February 2013");
});

test("A5: the ingredients are the statute's words (the cleaned text, not the raw), nothing says 'met', not_assessed is kept", () => {
  const v = parseA5(body(a5))!;
  assert.equal(v.ingredients.length, 6);
  assert.ok(v.ingredients[3].words.includes("[footnote 3:"), "the cleaned words carry the footnote the engine placed");
  assert.ok(!JSON.stringify(v).includes("statute_words_raw"));
  assert.ok(v.notAssessed.length >= 4);
  assert.doesNotMatch(JSON.stringify(v), /\bmet\b/i);
  assert.equal(v.offence, "Dishonour of a cheque (Negotiable Instruments Act, 1881, s.138)");
  assert.equal(v.statuteNames.rows[0].status, "Not added yet");
});

test("S1 and A1: citation rows keep text, status and reporter; the not-assessed lists and wording stay", () => {
  const s = parseS1(body(s1))!;
  assert.equal(s.papers[0].citations[0].text, "(2014) 8 SCC 273");
  assert.equal(s.papers[0].citations[0].status, "found");
  assert.ok(s.notAssessed.length >= 3 && s.wording);
  const a = parseA1(body(a1))!;
  assert.deepEqual(a.citations.map((c) => c.status), ["found", "not_found", a.citations[2].status]);
  assert.ok(a.summary && a.notAssessed.length >= 3);
});

test("a body with no run_id, or null, is refused by every reader", () => {
  for (const f of [parseA1, parseA3, parseA5, parseS1]) { assert.equal(f(null), null); assert.equal(f({}), null); }
});

import b3computed from "./fixtures/preview/b3_s138_checklist_computed.json";
import b3refer from "./fixtures/preview/b3_s138_checklist_refer.json";
import { parseB3 } from "./previewParsers";

test("B3: both counting conventions are kept on every counted step, the REFER texts and read-as dates show, nothing says a deadline is missed", () => {
  const c = parseB3(body(b3computed))!;
  assert.equal(c.steps.length, 4);
  assert.equal(c.steps[0].status, "INSIDE");
  assert.deepEqual(c.steps[0].counts.map((x) => x.periodEnds), ["2013-05-01", "2013-04-30"]);
  assert.equal(c.steps[3].status, "REFER");
  const r = parseB3(body(b3refer))!;
  assert.ok(r.steps.every((s) => s.status === "REFER" && s.refer.length > 0));
  assert.equal(r.inputs[0].readAs, "2013-02-01");
  assert.ok(r.inputs[0].dayFirst && !r.inputs[0].confirmed);
  assert.ok(r.notAssessed.length >= 6 && r.notes.length >= 1);
});
