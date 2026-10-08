import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ApiError } from "./api";
import {
  CITATION_MAX,
  PREVIEW_LABEL,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_ENABLED,
  productStatus,
  QUOTE_MAX,
  VERIFY_STATUSES,
  checkInputs,
  classifyVerifyError,
  verifyView,
} from "./citationCheck";

test("the preview label is exactly the decided wording", () => {
  assert.equal(PREVIEW_LABEL, "preview: accuracy not yet measured");
});

test("the five statuses the engine can answer are shown verbatim and known", () => {
  assert.deepEqual([...VERIFY_STATUSES], ["VERIFIED", "EXISTS_QUOTE_NOT_FOUND", "NOT_IN_INDEX", "MALFORMED", "CONFLICT"]);
  for (const s of VERIFY_STATUSES) {
    const v = verifyView({ result: s, note: "A fixed note." });
    assert.equal(v.status, s);
    assert.equal(v.known, true);
    assert.equal(v.note, "A fixed note.");
  }
});

test("an unknown status is shown as sent and flagged, never reworded", () => {
  const v = verifyView({ result: "SOMETHING_NEW", note: "n" });
  assert.equal(v.status, "SOMETHING_NEW");
  assert.equal(v.known, false);
});

test("the engine's note is shown as sent, but a note carrying the word 'fake' is withheld, never reworded", () => {
  const ok = "The citation resolves to an indexed case and the quote appears in its text.";
  assert.equal(verifyView({ result: "VERIFIED", note: ok }).note, ok);
  const bad = "The index holds no evidence either way: this is not a finding that the citation is fake.";
  const v = verifyView({ result: "NOT_IN_INDEX", note: bad });
  assert.equal(v.note, null);
  assert.equal(v.noteWithheld, true);
  assert.equal(v.status, "NOT_IN_INDEX");
  assert.equal(verifyView({ result: "MALFORMED", note: "" }).noteWithheld, false);
});

test("a failed check gets the signed wording for each coded refusal and distinct wording for the generic cases", () => {
  const k = (e: unknown) => classifyVerifyError(e);
  assert.equal(k(new ApiError(503, "/x", { code: "verify_timeout" })).kind, "timeout");
  assert.equal(k(new ApiError(503, "/x", { code: "verify_at_capacity" })).kind, "at_capacity");
  assert.equal(k(new ApiError(503, "/x", { code: "citation_index_unavailable" })).kind, "index_unavailable");
  assert.equal(k(new DOMException("t", "TimeoutError")).kind, "timeout");
  assert.equal(k(new DOMException("a", "AbortError")).kind, "cancelled");
  assert.equal(k(new ApiError(401, "/x")).kind, "signed_out");
  assert.match(k(new ApiError(429, "/x", { retryAfter: 9 })).message, /Seconds to wait: 9/);
  assert.equal(k(new ApiError(500, "/x")).kind, "server");
  assert.equal(k(new TypeError("fetch failed")).kind, "network");
  for (const e of [new ApiError(503, "/x", { code: "verify_timeout" }), new ApiError(503, "/x", { code: "citation_index_unavailable" }), new ApiError(500, "/x")]) {
    assert.doesNotMatch(k(e).message, /\bfake\b/i);
  }
});

test("the inputs are checked against the engine's limits before a request is sent", () => {
  assert.equal(checkInputs("(2020) 3 SCC 456", "a quote").ok, true);
  assert.equal(checkInputs("   ", "a quote").ok, false);
  assert.equal(checkInputs("(2020) 3 SCC 456", " ").ok, false);
  assert.equal(checkInputs("x".repeat(CITATION_MAX + 1), "q").ok, false);
  assert.equal(checkInputs("c", "x".repeat(QUOTE_MAX + 1)).ok, false);
  assert.equal(checkInputs("x".repeat(CITATION_MAX), "x".repeat(QUOTE_MAX)).ok, true);
});

// -- the product status wording (#533): wired, OFF by default ------------------------------------------------------------------

// The engine's own five labels, copied verbatim from citation_status.py (fixtures/engineCitationLabels.json, with its source and sha), never invented ones.
const ENGINE_LABELS = JSON.parse(readFileSync(join(__dirname, "fixtures", "engineCitationLabels.json"), "utf8")).labels as Record<string, { status: string; label: string }>;
const PRODUCT = Object.fromEntries(
  Object.entries(ENGINE_LABELS).map(([result, a]) => [result, { result, ...a, preview: true, verified: result === "VERIFIED" }]),
) as Record<"VERIFIED" | "EXISTS_QUOTE_NOT_FOUND" | "NOT_IN_INDEX" | "CONFLICT" | "MALFORMED", { result: string; status: string; label: string; preview: boolean; verified: boolean }>;

test("the product status is OFF in this build by default, and off shows only the engine's status and note", () => {
  assert.equal(PRODUCT_STATUS_ENABLED, false);
  for (const reply of Object.values(PRODUCT)) {
    const v = verifyView({ ...reply, note: "A fixed note." });
    assert.equal(v.product, null);
    assert.equal(v.status, reply.result);
    assert.equal(v.note, "A fixed note.");
  }
});

test("switched on, each of the five product statuses shows the engine's label verbatim with the preview flag", () => {
  assert.deepEqual([...PRODUCT_STATUSES], ["verified", "quote_not_found", "not_in_index", "conflict", "malformed"]);
  for (const reply of Object.values(PRODUCT)) {
    const p = productStatus({ ...reply, note: "n" }, true);
    assert.deepEqual(p, { status: reply.status, label: reply.label, preview: true });
    assert.equal(verifyView({ ...reply, note: "n" }, true).status, reply.result, "the engine status is still shown verbatim beside it");
  }
});

test("fail closed: no positive wording from anything but a real verified result", () => {
  const on = (r: object) => productStatus({ result: "NOT_IN_INDEX", note: "n", ...r } as never, true);
  // a missing, unknown or empty status or label gives nothing
  assert.equal(productStatus({ result: "VERIFIED", note: "n" }, true), null);
  assert.equal(on({ status: "something_new", label: "x" }), null);
  assert.equal(on({ status: "not_in_index", label: "" }), null);
  // a label that says "Verified" on any other status is refused
  assert.equal(on({ status: "not_in_index", label: "Verified: all good" }), null);
  // verified needs the engine's VERIFIED result and not verified:false
  assert.equal(productStatus({ ...PRODUCT.VERIFIED, result: "NOT_IN_INDEX", note: "n" }, true), null);
  assert.equal(productStatus({ ...PRODUCT.VERIFIED, verified: false, note: "n" }, true), null);
  // a non-verified status next to a VERIFIED result is contradictory: refused
  assert.equal(productStatus({ ...PRODUCT.NOT_IN_INDEX, result: "VERIFIED", note: "n" }, true), null);
  // banned words in a label
  for (const w of ["fake", "fabricated", "hallucinated", "invalid", "false"]) assert.equal(on({ status: "conflict", label: `this is ${w}` }), null, w);
});

test("every one of the engine's real labels passes the guards when switched on (R2 on #76: the real conflict label was refused)", () => {
  assert.deepEqual(Object.keys(ENGINE_LABELS).sort(), [...VERIFY_STATUSES].sort());
  for (const [result, a] of Object.entries(ENGINE_LABELS)) {
    const p = productStatus({ result, note: "n", ...a, preview: true, verified: result === "VERIFIED" }, true);
    assert.deepEqual(p, { status: a.status, label: a.label, preview: true }, result);
  }
});

test("fail closed (#75): a positive-claim word anywhere in a label, in any case or width, is refused on every status but verified", () => {
  const on = (r: object) => productStatus({ result: "CONFLICT", note: "n", ...r } as never, true);
  for (const label of ["conflict: citation VERIFIED elsewhere", "Not Verified", "the case exists", "ｖｅｒｉｆｉｅｄ", "ver\u200Bified", "authentic", "quote confirmed", "this is correct"]) {
    assert.equal(on({ status: "conflict", label }), null, label);
  }
  // the engine's own wording for the other four still shows
  for (const k of ["EXISTS_QUOTE_NOT_FOUND", "NOT_IN_INDEX", "CONFLICT", "MALFORMED"] as const) assert.ok(productStatus({ ...PRODUCT[k], note: "n" }, true), k);
});

test("fail closed (#75): result and status must be the engine's own pair, and `verified` must agree", () => {
  const swapped = [
    { ...PRODUCT.CONFLICT, result: "NOT_IN_INDEX" },
    { ...PRODUCT.NOT_IN_INDEX, result: "EXISTS_QUOTE_NOT_FOUND" },
    { ...PRODUCT.MALFORMED, result: "CONFLICT" },
    { ...PRODUCT.EXISTS_QUOTE_NOT_FOUND, result: "MALFORMED" },
    { ...PRODUCT.CONFLICT, result: "something_new" },
    { ...PRODUCT.CONFLICT, verified: true },
  ];
  for (const r of swapped) assert.equal(productStatus({ ...r, note: "n" }, true), null, `${r.result}/${r.status}/${r.verified}`);
});

test("the preview flag defaults to shown unless the engine says false explicitly", () => {
  assert.equal(productStatus({ ...PRODUCT.CONFLICT, preview: undefined, note: "n" }, true)?.preview, true);
  assert.equal(productStatus({ ...PRODUCT.CONFLICT, preview: false, note: "n" }, true)?.preview, false);
});
