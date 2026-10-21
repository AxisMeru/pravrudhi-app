import assert from "node:assert/strict";
import test from "node:test";

// OCR_MARKER_FIELD_CONTRACT (Track B, fc8683d55b51; engine 0.6.27 #603/#605/#606/#607/#608): the page renders the engine's `ocr_marker` as sent, only beside an item with from_ocr true; absent from_ocr is nothing.
import { SCANNED_INTAKE, rowScan } from "./scannedIntake";
import { parseA3, parseCaseCheck, parseHearing, parseS1 } from "./previewParsers";
import { parsePapers } from "./previewApi";
import { parseSynopsis } from "./previewDraftingParsers";
const MARK = "Read from a scanned page: check this against the paper.";
test("rowScan renders the engine's own ocr_marker string as sent (not retyped), only for from_ocr true; absent or false from_ocr shows nothing", () => {
  assert.equal(rowScan({ from_ocr: true, ocr_marker: "ENGINE LINE" }, "d", true)!.marker, "ENGINE LINE");
  assert.equal(rowScan({ from_ocr: true }, "d", true)!.marker, MARK, "from_ocr true with no string: R1's pinned line, never an unmarked scanned row");
  assert.equal(rowScan({ from_ocr: false, ocr_marker: MARK }, "d", true), undefined, "a marker on a row the engine says is not from a scan is never shown");
  assert.equal(rowScan({}, "d", true), undefined);
  assert.equal(rowScan({ from_ocr: true, ocr_marker: MARK }, "d", false), undefined, "flag off: nothing");
});
const ON = { skip: !SCANNED_INTAKE };
test("every surface carries the marker per row: chronology, cheque case, hearing pack, citation sweep (beside the status), papers; text-layer rows carry none", ON, () => {
  const a3 = parseA3({ run_id: "r", events: [{ date_as_written: "3 March 2024", document_name: "scan.pdf", page: 1, from_ocr: true, ocr_marker: MARK }, { date_as_written: "4 May 2024", document_name: "scan.pdf", page: 2, from_ocr: false }] })!;
  assert.equal(a3.sections[0].rows[0].scan?.marker, MARK);
  assert.equal(a3.sections[0].rows[1].scan, undefined);
  const cc = parseCaseCheck({ run_id: "r", candidates: { roles: { cheque: [{ candidate_id: "c1", value: "3 March 2024", source: "scan.pdf p.1", page: 1, from_ocr: true, ocr_marker: MARK }] } } })!;
  assert.equal(cc.roles[0].candidates[0].scan?.marker, MARK);
  const hp = parseHearing({ run_id: "r", timeline: { rows: [{ date_as_written: "3 March 2024", source: "scan.pdf p.1", from_ocr: true, ocr_marker: MARK }, { date_as_written: "2 September 2026", source: "scan.pdf p.2", from_ocr: false }] }, next_dates: { rows: [{ date_as_written: "5 May 2025", source: "scan.pdf p.1", from_ocr: true, ocr_marker: MARK }] } })!;
  assert.equal(hp.timeline.rows[0].scan?.marker, MARK);
  assert.equal(hp.timeline.rows[1].scan, undefined);
  assert.equal(hp.nextDates.rows[0].scan?.marker, MARK);
  const hc = parseHearing({ run_id: "r", citations: { switched_on: true, needs_attention: [{ text: "(2086) 1 SCC 99", statuses: ["not_found"], from_ocr: true, ocr_marker: MARK, where: [{ document_name: "scan.pdf", page: 1 }] }, { text: "(2087) 4 SCC 512", statuses: ["not_found"], where: [{ document_name: "scan.pdf", page: 1, from_ocr: true, ocr_marker: MARK }] }], not_checked: [{ text: "(2088) 2 SCC 7", statuses: ["not_checked"], from_ocr: false, where: [{ document_name: "typed.pdf", page: 1 }] }] } })!;
  assert.equal(hc.citations.needsAttention[0].scan?.marker, MARK, "entry-level marker");
  assert.equal(hc.citations.needsAttention[1].scan?.marker, MARK, "a page it was read from is from a scan");
  assert.equal(hc.citations.notChecked[0].scan, undefined);
  const s1 = parseS1({ run_id: "r", papers_read: [{ name: "scan.pdf", citations: [{ text: "(2086) 1 SCC 99", status: "not_found", page: 1, from_ocr: true, ocr_marker: MARK }, { text: "(2087) 4 SCC 512", status: "found", page: 2, from_ocr: false }] }] })!;
  assert.equal(s1.papers[0].citations[0].scan?.marker, MARK);
  assert.equal(s1.papers[0].citations[0].status, "not_found");
  assert.equal(s1.papers[0].citations[1].scan, undefined);
  const pp = parsePapers({ documents: [{ doc_id: "a", name: "scan.pdf", n_pages: 2, from_ocr: true, ocr_pages: [1], ocr_marker: MARK }, { doc_id: "b", name: "typed.pdf", n_pages: 1, from_ocr: false }] }).papers;
  assert.equal(pp[0].scan?.marker, MARK);
  assert.equal(pp[1].scan, undefined);
});
test("list of dates (A8): a marker on the row, or on a date inside the row, shows beside the row; none when no date is from a scan", ON, () => {
  const v = parseSynopsis({ run_id: "r", state: "template_only", list_of_dates: { rows: [
    { row_id: 1, ref: "F1", date_as_written: "3 March 2024", source: "scan.pdf p.1", from_ocr: true, ocr_marker: MARK, dates: [{ date_as_written: "3 March 2024", from_ocr: true, ocr_marker: MARK }] },
    { row_id: 2, ref: "F2", date_as_written: "4 May 2024", source: "scan.pdf p.2", dates: [{ date_as_written: "4 May 2024", from_ocr: true, ocr_marker: MARK }] },
    { row_id: 3, ref: "F3", date_as_written: "9 June 2024", source: "typed.pdf p.1", from_ocr: false, dates: [{ date_as_written: "9 June 2024", from_ocr: false }] },
  ] } });
  const rows = v!.dates!.rows;
  assert.equal(rows[0].scan?.marker, MARK);
  assert.equal(rows[1].scan?.marker, MARK);
  assert.equal(rows[2].scan, undefined);
});

test("flag OFF (the default build): no row carries scan info, whatever the engine sends", { skip: SCANNED_INTAKE }, () => {
  const a3 = parseA3({ run_id: "r", events: [{ date_as_written: "3 March 2024", document_name: "scan.pdf", page: 1, from_ocr: true, ocr_marker: MARK }] })!;
  assert.equal(a3.sections[0].rows[0].scan, undefined);
  assert.equal(parseS1({ run_id: "r", papers_read: [{ name: "scan.pdf", citations: [{ text: "(2086) 1 SCC 99", status: "not_found", from_ocr: true, ocr_marker: MARK }] }] })!.papers[0].citations[0].scan, undefined);
});
