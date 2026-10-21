import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { previewRefusal } from "./previewRefusal";
import { TOOL_OFF_BY_ROUTE, TOOL_OFF_FALLBACK, toolOffLine } from "./toolOffLines";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);

// R1's lines by hash (r1-seat2/TOOL_OFF_LINES_R1_2026-10-21.md, sha12 27fd5ce28704)
const PINS: Record<string, string> = {
  "/matter-spans/matters": "a205520db026f1cb",
  "/matter-spans/documents": "a205520db026f1cb",
  "/chronology": "736a07f75c0ae10c",
  "/review-agenda": "8e03d61de17b514e",
  "/matter-citation-sweep": "9acabdb3461c787e",
  "/quashing-agenda": "420bfffc4b1764c7",
  "/cheque-case-check": "6e81382917007d38",
  "/matter-hearing-pack": "fe4e7f9bd3025cb3",
  "/s138-checklist": "a6079ed7959b9313",
  "/bail-draft": "ff2b8f3c1ed21484",
  "/synopsis-dates": "9b43bca951720c9a",
};

test("every per-tool 'switched off' line is R1's by hash, and the fallback is too", () => {
  assert.deepEqual(Object.keys(TOOL_OFF_BY_ROUTE).sort(), Object.keys(PINS).sort());
  for (const [route, pin] of Object.entries(PINS)) assert.equal(h(TOOL_OFF_BY_ROUTE[route]), pin, route);
  assert.equal(h(TOOL_OFF_FALLBACK), "76806ae826e04652");
  assert.equal(toolOffLine("/draft-citation-check"), TOOL_OFF_FALLBACK, "any other route falls back");
});

test("a 404 shows the tool's line only when the caller names the route (it has ruled out 'matter gone'); without a route the earlier line stands; other statuses are unchanged", () => {
  assert.equal(previewRefusal(404, { detail: "x" }, "/chronology"), "Chronology is not switched on in this deployment.");
  assert.equal(previewRefusal(404, { detail: "x" }), "This workflow is not available here.");
  assert.equal(previewRefusal(404, { detail: "Stored papers are not available." }, "/matter-spans/documents"), "Adding papers is not available here.");
  assert.equal(previewRefusal(409, { error: "no_papers" }, "/chronology"), "There are no papers to read. Add papers first.");
  assert.equal(previewRefusal(503, null, "/chronology"), "The service is busy. Try again in a moment.");
});
