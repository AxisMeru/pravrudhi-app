import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { SECTION_LOOKUP_COPY } from "./sectionLookupCopy";
import { normaliseSection, parseLookup, readingOrder } from "./sectionLookup";

const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", "preview", `section_lookup_${n}.json`), "utf8")) as Record<string, unknown>;

test("IPC 302 one_to_one: the engine's line and both bodies, the old body first with its three source lines, the new body with its own line", () => {
  const v = parseLookup(fx("ipc302_one_to_one"))!;
  assert.equal(v.state, "one_to_one");
  assert.equal(v.line, "The table matches this section to one section: Section 103.");
  assert.equal(v.old.lines.length, 3);
  assert.equal(v.news.length, 1);
  assert.equal(v.news[0].id, "BNS/Section 103");
  assert.deepEqual(readingOrder(v).map((b) => b.section), ["Section 302", "Section 103"]);
});

test("IPC 420 check_both: every new body listed is shown, in the engine's order, with no state of our own", () => {
  const v = parseLookup(fx("ipc420_check_both"))!;
  assert.equal(v.state, "check_both");
  assert.ok(v.line.startsWith("The table does not match"));
  assert.equal(readingOrder(v).length, 1 + v.news.length);
});

test("IPC 124A no_match: the old body only, no new side invented", () => {
  const v = parseLookup(fx("ipc124a_no_match"))!;
  assert.equal(v.state, "no_match");
  assert.equal(v.news.length, 0);
  assert.equal(readingOrder(v).length, 1);
});

test("IPC 999 not_in_table: nothing but the line; no old body is read or shown", () => {
  const v = parseLookup(fx("ipc999_not_in_table"))!;
  assert.equal(v.state, "not_in_table");
  assert.equal(v.old.held, false);
  assert.equal(readingOrder(v).length, 0);
});

test("CrPC 154: a body that is not held shows only its not-held line, never text", () => {
  const v = parseLookup(fx("crpc154_not_held"))!;
  assert.equal(v.old.held, false);
  assert.equal(v.old.text, null);
  assert.deepEqual(v.old.lines, ["The text of this section is not held. Check the official text."]);
});

test("an answer that is not the contract's shape is no view (so the card says the look-up is not available): unknown state, missing line, a held body without text, wrong invariants, non-object", () => {
  const base = fx("ipc302_one_to_one");
  assert.equal(parseLookup(null), null);
  assert.equal(parseLookup({ ...base, state: "equivalent" }), null);
  assert.equal(parseLookup({ ...base, line: undefined }), null);
  assert.equal(parseLookup({ ...base, new: [] }), null, "one_to_one with no new body");
  assert.equal(parseLookup({ ...base, old: { held: true, lines: [], text: "" } }), null, "held with no text");
  assert.equal(parseLookup({ ...fx("ipc999_not_in_table"), old: { held: true, lines: [], text: "x" } }), null, "not_in_table cannot hold an old body");
  assert.equal(parseLookup({ ...fx("ipc124a_no_match"), new: [(base.new as unknown[])[0]] }), null, "no_match lists no new body");
});

test("check_both may carry an empty new list with the old body only (the contract's check_old_only case) and still parses", () => {
  const v = parseLookup({ ...fx("ipc420_check_both"), new: [], line: "This section cannot be matched in the table. Only the old text is shown. Check the official texts." })!;
  assert.equal(v.news.length, 0);
  assert.equal(readingOrder(v).length, 1);
});

test("the section number is trimmed and upper-cased, and only 1-3 digits plus up to 3 letters are sent", () => {
  assert.equal(normaliseSection(" 302 "), "302");
  assert.equal(normaliseSection("124a"), "124A");
  assert.equal(normaliseSection("376da"), "376DA");
  for (const bad of ["", "  ", "1234", "12 4", "30\n2", "302X5", "abc", "-3", "3.02", "1234A", "12ABCD"]) assert.equal(normaliseSection(bad), null, JSON.stringify(bad));
});

test("no word of ours implies a match (equivalent, replaces, same as, current, in force, corresponds, verified)", () => {
  assert.doesNotMatch(Object.values(SECTION_LOOKUP_COPY).join(" "), /equivalent|replaces|same as|\bcurrent\b|in force|correspond|verified|accurate/i);
});
