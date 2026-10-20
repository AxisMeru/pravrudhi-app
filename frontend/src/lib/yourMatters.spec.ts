import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parseMyMatters } from "./previewApi";
import { DH_LIST_LINE, YM_NOTE, YOUR_MATTERS, YOUR_MATTERS_TEXT, confirmLine, matterLabel, papersCount } from "./yourMatters";
import { dataHandlingSections } from "./dataHandling";

const h16 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

const A = "0123456789abcdef0123456789abcdef", B = "fedcba9876543210fedcba9876543210";

test("the list is read as the engine sends it: well-formed rows in order, a truncated flag that is true only when the engine says so; anything else is dropped, never guessed", () => {
  assert.deepEqual(parseMyMatters({ matters: [{ matter_id: A, papers: 3 }, { matter_id: B, papers: 0 }], truncated: false }), { matters: [{ matterId: A, papers: 3 }, { matterId: B, papers: 0 }], truncated: false });
  assert.equal(parseMyMatters({ matters: [], truncated: true })!.truncated, true);
  assert.equal(parseMyMatters({ matters: [], truncated: "yes" })!.truncated, false);
  assert.deepEqual(parseMyMatters({ matters: [{ matter_id: "short", papers: 1 }, { matter_id: A, papers: -1 }, { matter_id: A, papers: 1.5 }, { matter_id: A }, null, "x", { matter_id: B, papers: 2 }] })!.matters, [{ matterId: B, papers: 2 }]);
  assert.equal(parseMyMatters(null), null);
  assert.equal(parseMyMatters({ nope: 1 }), null);
});

test("the flag is off unless NEXT_PUBLIC_YOUR_MATTERS is exactly 1; the page shows the list only behind it and only for a signed-in visitor; a number labels a row, never an id", () => {
  assert.equal(YOUR_MATTERS, process.env.NEXT_PUBLIC_YOUR_MATTERS === "1");
  const page = readFileSync(join(__dirname, "..", "app", "matter-tools", "page.tsx"), "utf8");
  assert.match(page, /\{YOUR_MATTERS && !signedOut && \(\s*<YourMatters/);
  assert.equal(matterLabel(2), "Matter 2");
  assert.equal(papersCount(1), "1 paper");
  assert.equal(papersCount(3), "3 papers");
  const comp = readFileSync(join(__dirname, "..", "components", "preview", "YourMatters.tsx"), "utf8");
  assert.doesNotMatch(comp, />\s*\{m\.matterId\}\s*</, "an id is never printed");
});

// R1's words v2 (YOUR_MATTERS_WORDS_V2 82c7d921e0b2), by hash.
test("every 'Your matters' line is R1's by hash; the delete question names the number and the count in R1's three forms; there is no scope line", () => {
  assert.equal(h16(YOUR_MATTERS_TEXT.heading), "1f5c412c19048e5d");
  assert.equal(h16(YOUR_MATTERS_TEXT.open), "ed077f3d8125d60d");
  assert.equal(h16(YOUR_MATTERS_TEXT.delete), "e2d0a54968ead24e");
  assert.equal(h16(YOUR_MATTERS_TEXT.confirmYes), "7b05a8e35af97cc6");
  assert.equal(h16(YOUR_MATTERS_TEXT.confirmCancel), "19766ed6ccb2f4a3");
  assert.equal(h16(YOUR_MATTERS_TEXT.deleted), "7d20b9389e62301b");
  assert.equal(h16(YOUR_MATTERS_TEXT.empty), "396b162d70db5492");
  assert.equal(h16(YOUR_MATTERS_TEXT.truncated), "3d1687352bc99fd5");
  assert.equal(h16(matterLabel(0).replace("0", "{n}")), "954edc623f83d36d");
  assert.equal(h16(papersCount(1)), "aa8d34127537ac13");
  assert.equal(h16(papersCount(7).replace("7", "{n}")), "b29985bdb7fe97ed");
  assert.equal(h16(confirmLine(3, 5).replace("3", "{n}").replace("5", "{k}")), "531d384b4779f8c1");
  assert.equal(h16(confirmLine(3, 1).replace("3", "{n}")), "142ca35eac49f0a1");
  assert.equal(h16(confirmLine(3, 0).replace("3", "{n}")), "f0fb0cbf9e577442");
  assert.equal(confirmLine(2, 0), "Delete Matter 2? It is removed from this service's store. This cannot be undone.");
  assert.ok(!("scope" in YOUR_MATTERS_TEXT), "no scope line: 'Your matters' is true whichever tenant the session has");
  assert.equal(h16(YM_NOTE), "559d274110ed22e2");
  assert.equal(h16(DH_LIST_LINE), "238de48b950dafa5");
  assert.doesNotMatch(`${YM_NOTE} ${DH_LIST_LINE}`, /organisation/i);
});

test("with the list on, /data-handling swaps the two interim lines (reload, no tested request path) for the one list line; off, the interim lines stay", () => {
  const on = dataHandlingSections(false, false, true).find((s) => s.id === "papers")!.paragraphs;
  const off = dataHandlingSections(false, false, false).find((s) => s.id === "papers")!.paragraphs;
  assert.ok(off.some((p) => h16(p) === "147fd14bcc077deb") && off.some((p) => h16(p) === "be43eb4ec9dd8d32"));
  assert.ok(!on.some((p) => h16(p) === "147fd14bcc077deb" || h16(p) === "be43eb4ec9dd8d32"));
  assert.ok(on.some((p) => h16(p) === "238de48b950dafa5"));
  assert.equal(on[on.length - 1], off[off.length - 1], "the closing 'run records are a different thing' line stays last");
});
