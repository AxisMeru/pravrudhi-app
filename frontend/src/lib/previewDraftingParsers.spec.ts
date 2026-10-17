import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { bailBody, factsBody, parseBail, parseSynopsis, synopsisBody, type BailForm } from "./previewDraftingParsers";

const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", "preview", `${n}.json`), "utf8"));

test("bail drafted: label, framing lines, unconfirmed line, text and notes are kept as sent", () => {
  const v = parseBail(fx("bail_response_drafted"))!;
  assert.equal(v.state, "drafted");
  assert.match(v.label ?? "", /^Preview:/);
  assert.equal(v.framing?.status, "single");
  assert.equal(v.framing?.lines.length, 1);
  assert.match(v.framing?.unconfirmed ?? "", /not yet confirmed/);
  assert.match(v.text ?? "", /^Draft for lawyer review\./);
  assert.equal(v.notes.length, 2);
  assert.equal(v.factsSetAside, 1);
});

test("bail referred: no text, the referral sentence is kept; a straddle keeps both framings", () => {
  const s = parseBail(fx("bail_response_referred_sensitive"))!;
  assert.equal(s.state, "referred");
  assert.equal(s.text, null);
  assert.equal(s.referral?.code, "sensitive_section");
  const t = parseBail(fx("bail_response_referred_straddle"))!;
  assert.equal(t.referral?.code, "dates_straddle");
  assert.equal(t.framing?.status, "straddle");
  assert.equal(t.framing?.lines.length, 2);
});

test("readers return null for a body that is not an answer", () => {
  assert.equal(parseBail(null), null);
  assert.equal(parseBail({ state: "drafted" }), null);
  assert.equal(parseBail({ run_id: "x", state: "weird" }), null);
  assert.equal(parseSynopsis({ run_id: 3 }), null);
});

test("synopsis table_only: rows keep the paper's own date characters and both readings of an ambiguous date", () => {
  const v = parseSynopsis(fx("synopsis_response_table_only"))!;
  assert.equal(v.state, "table_only");
  assert.deepEqual(v.dates?.columns, ["Date", "Event", "Source"]);
  assert.ok((v.dates?.rows.length ?? 0) >= 2);
  const amb = v.dates!.rows.find((r) => r.ambiguous)!;
  assert.equal(amb.readings.length, 2);
  assert.ok(amb.dateAsWritten.length > 0);
  assert.equal(v.synopsis?.paragraphs.length, 0);
  assert.ok(v.synopsis?.fallback);
  assert.ok(v.datesNote);
});

test("synopsis referred (Track C) and refused (Track A's page-level shape) both read as no draft with the sentence", () => {
  const r = parseSynopsis(fx("synopsis_response_referred"))!;
  assert.equal(r.state, "referred");
  assert.ok(r.referral?.text);
  const a = parseSynopsis({ run_id: "r", state: "refused", refused: "No draft is made.", list_of_dates: { heading: "H", columns: [], rows: [], none_line: null, cut_line: null }, synopsis: { heading: "S", paragraphs: [], fallback_line: null } })!;
  assert.equal(a.state, "refused");
  assert.equal(a.referral?.text, "No draft is made.");
  assert.equal(a.dates?.rows.length, 0);
});

test("a page-level synopsis (tables at the top) reads the same as one under draft", () => {
  const v = parseSynopsis({ run_id: "r", state: "drafted", label: "L", list_of_dates: { heading: "H", columns: ["Date"], rows: [{ row_id: 4, date_as_written: "the day", ambiguous: false, readings: null, event_quote: "q", event_line: "e", source: "p.1" }] }, synopsis: { heading: "S", paragraphs: [{ text: "The petitioner states that x." }] }, notes_for_lawyer: [] })!;
  assert.equal(v.dates?.rows[0].eventLine, "e");
  assert.equal(v.synopsis?.paragraphs[0], "The petitioner states that x.");
});

const FORM: BailForm = { consent: true, kind: "bail", forum: "trial_court", offence: "2024-08-01", fir: "2024-08-02", facts: [{ text: " A fact. ", applicant: true, grounds: ["antecedents"] }, { text: "Other.", applicant: false, grounds: ["flight"] }, { text: "  ", applicant: true, grounds: [] }], tags: [], sections: " IPC 370 , ,BNS 143(2)" };

test("bailBody sends only the lawyer's declarations and nothing inferred", () => {
  const b = bailBody(FORM)!;
  assert.deepEqual(b.facts, [{ text: "A fact.", side: "applicant", grounds: ["antecedents"] }, { text: "Other.", side: "other" }]);
  assert.deepEqual(b.charged_sections, ["IPC 370", "BNS 143(2)"]);
  assert.equal(b.forum, "trial_court");
  assert.equal("tags" in b, false);
});

test("bailBody is null while consent, a date, a forum for bail or a fact is missing; anticipatory bail needs no forum", () => {
  assert.equal(bailBody({ ...FORM, consent: false }), null);
  assert.equal(bailBody({ ...FORM, offence: "" }), null);
  assert.equal(bailBody({ ...FORM, fir: "2024-8-2" }), null);
  assert.equal(bailBody({ ...FORM, forum: "" }), null);
  assert.equal(bailBody({ ...FORM, facts: [{ text: "", applicant: true, grounds: [] }] }), null);
  const a = bailBody({ ...FORM, kind: "anticipatory_bail", forum: "" })!;
  assert.equal("forum" in a, false);
});

test("synopsisBody needs consent; include_row_ids only when rows were unticked", () => {
  const rows = [{ text: "x", applicant: true, grounds: [] }];
  assert.equal(synopsisBody("m", false, rows, "", null), null);
  const first = synopsisBody("0123456789abcdef0123456789abcdef", true, rows, " writ ", null)!;
  assert.equal(first.document_label, "writ");
  assert.equal("include_row_ids" in first, false);
  assert.deepEqual(synopsisBody("m", true, rows, "", [1, 3])!.include_row_ids, [1, 3]);
  assert.equal(factsBody([{ text: "y".repeat(2000), applicant: false, grounds: [] }])[0].text.length, 1500);
});

test("two dates in one sentence are one row; each date keeps its own readings", () => {
  const v = parseSynopsis({ run_id: "r", state: "table_only", draft: { list_of_dates: { heading: "H", columns: [], rows: [{ row_id: 7, date_as_written: "1.2.2020 and 3 March 2020", dates: [{ date_as_written: "1.2.2020", readings: ["2020-02-01", "2020-01-02"], ambiguous: true }, { date_as_written: "3 March 2020", readings: ["2020-03-03"], ambiguous: false }], event_quote: "q" }] } } })!;
  const r = v.dates!.rows[0];
  assert.equal(r.dates.length, 2);
  assert.equal(r.dates[0].readings.length, 2);
  assert.equal(r.dates[1].ambiguous, false);
  assert.equal(r.dateAsWritten, "1.2.2020 and 3 March 2020");
});
