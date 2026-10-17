import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import rowsFile from "../data/nyayasiddhi/rows.json";
import { NS_COMING, comingLines } from "./nyayasiddhiComing";
import { NS_HIDDEN_SPLIT } from "./nyayasiddhiSubmit";
import { parseRows, type ResultRow } from "./nyayasiddhiRows";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  coming_heading: "747d2e8ca626eb13",
  coming_outside: "5e48b6ca4941fc43",
  coming_status: "0c8239b267b1a582",
  coming_rows: "567855cf8959d220",
};

test("the block's sentences are exactly R1's, by hash, and the hidden-set sentence is the one constant", () => {
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h((NS_COMING as Record<string, string>)[k]), hash, k);
  assert.equal(h(NS_HIDDEN_SPLIT), "1502d9c1b8e3fdf1");
});

const real = parseRows(rowsFile);

test("with the signed rows (all organiser entries, all self-reported) the block shows the four lines in order", () => {
  assert.ok(real.length > 0);
  assert.deepEqual(comingLines(real), [NS_COMING.coming_outside, NS_COMING.coming_status, NS_HIDDEN_SPLIT, NS_COMING.coming_rows]);
});

test("a line is dropped when it would not be true: an outside entry removes the organiser line, a re-scored row removes the self-reported line, no rows removes both", () => {
  const outside: ResultRow = { ...real[0], organiserEntry: false };
  assert.ok(!comingLines([...real, outside]).includes(NS_COMING.coming_outside));
  const rescored: ResultRow = { ...real[0], status: "re-scored" };
  assert.ok(!comingLines([...real, rescored]).includes(NS_COMING.coming_status));
  assert.deepEqual(comingLines([]), [NS_HIDDEN_SPLIT, NS_COMING.coming_rows]);
});

test("no line carries a figure, a date or a count", () => {
  for (const l of comingLines(real)) assert.doesNotMatch(l, /\d/, l);
});
