import assert from "node:assert/strict";
import test from "node:test";

import { AGENDA_FIELDS, matterIdOf, parseAgenda, parsePapers, stringsOf } from "./previewApi";

const HEX = "0123456789abcdef0123456789abcdef";

test("matterIdOf accepts only a 32-hex id", () => {
  assert.equal(matterIdOf({ matter_id: HEX }), HEX);
  for (const bad of [null, {}, { matter_id: "xyz" }, { matter_id: HEX.toUpperCase() }, { matter_id: 5 }]) assert.equal(matterIdOf(bad as never), null);
});

test("parsePapers keeps well-formed rows only and the engine's pages note", () => {
  const r = parsePapers({ documents: [{ doc_id: "d1", name: "FIR", n_pages: 3, pages_without_text: [2], indexed_complete: false }, { doc_id: 5, name: "x" }, "no", { doc_id: "d2" }], pages_note: "note" });
  assert.deepEqual(r.papers, [{ docId: "d1", name: "FIR", pages: 3, pagesWithoutText: [2], complete: false }]);
  assert.equal(r.pagesNote, "note");
  assert.deepEqual(parsePapers(null), { papers: [], pagesNote: null });
});

test("stringsOf takes every string in the engine's order and skips other values", () => {
  assert.deepEqual(stringsOf({ label: "L", quote: "Q", n: 3, our_line: "O", list: ["a", 1, "b"] }), ["L", "Q", "O", "a", "b"]);
  assert.deepEqual(stringsOf(7), []);
});

test("parseAgenda reads the S3 fields in the contract's order, drops empty ones, and refuses a body with no run_id", () => {
  assert.equal(parseAgenda(null), null);
  assert.equal(parseAgenda({ standing_line: "x" }), null);
  const body: Record<string, unknown> = { run_id: "r", not_assessed: ["n1"], standing_line: "S", caution: { label: "L", quote: "Q", our_line: "O" }, categories: ["c1", "c2"], papers: { heading: "H", caption: "C", documents: [{ doc_id: "d", name: "N" }] }, extra_field: "never shown" };
  const out = parseAgenda(body)!;
  assert.deepEqual(out.map((f) => f.key), ["standing_line", "caution", "categories", "papers", "not_assessed"]);
  assert.deepEqual(out.find((f) => f.key === "papers")!.lines, ["H", "C", "d", "N"]);
  assert.ok(!out.some((f) => f.lines.includes("never shown")));
  assert.equal(AGENDA_FIELDS.length, 17);
});
