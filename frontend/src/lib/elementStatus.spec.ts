// The element-status presentation is the seam where an engine status becomes something a reader sees, so these
// tests are about truthfulness rather than styling: a status the judges did not conclude against must never
// render as a finding against the matter (AxisMeru/pravrudhi#37).

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  ELEMENT_STATUSES,
  elementStatusPresentation,
  isElementStatus,
  type ElementStatus,
} from "./elementStatus";

test("elementStatus: the four canonical statuses each get a distinct label and a distinct tone", () => {
  const labels = new Set<string>();
  const tones = new Set<string>();
  for (const status of ELEMENT_STATUSES) {
    const p = elementStatusPresentation(status);
    assert.equal(p.status, status);
    assert.equal(p.unknown, false);
    assert.ok(p.label.length > 0, `${status} has no label`);
    assert.ok(p.tone.length > 0, `${status} has no tone`);
    labels.add(p.label);
    tones.add(p.tone);
  }
  assert.equal(labels.size, ELEMENT_STATUSES.length, "two statuses share a label");
  assert.equal(tones.size, ELEMENT_STATUSES.length, "two statuses share a tone");
});

test("elementStatus: every canonical status has a mapping (trips if a fifth is added without one)", () => {
  // Parametrised over the canonical list rather than a hand-written one, so adding a status to ElementStatus
  // and ELEMENT_STATUSES without a switch arm fails here as well as at compile time.
  for (const status of ELEMENT_STATUSES) {
    assert.doesNotThrow(
      () => elementStatusPresentation(status),
      `${status} has no presentation mapping`,
    );
    assert.equal(isElementStatus(status), true);
  }
  assert.equal(ELEMENT_STATUSES.length, 4, "the canonical status list changed — review the mapping and these tests");
});

test("elementStatus: established is presented exactly as the page presented it before the extraction", () => {
  const p = elementStatusPresentation("established");
  assert.equal(p.label, "established");
  assert.equal(p.tone, "text-emerald-400 border-emerald-500/40 bg-emerald-500/10");
  assert.equal(p.verdict, "established");
});

test("elementStatus: not_confirmed and not_established are not presentationally identical", () => {
  const notConfirmed = elementStatusPresentation("not_confirmed");
  const notEstablished = elementStatusPresentation("not_established");
  assert.notEqual(notConfirmed.label, notEstablished.label);
  assert.notEqual(notConfirmed.tone, notEstablished.tone);
  assert.notEqual(notConfirmed.verdict, notEstablished.verdict);
});

test("elementStatus: not_confirmed reads as unmet confidence, never as a failure or a negative finding", () => {
  const p = elementStatusPresentation("not_confirmed");
  assert.match(p.label, /not confirmed/i);
  assert.ok(!/fail/i.test(p.label), `not_confirmed must never read as a failure, got "${p.label}"`);
  // The judges leaned established; the served tau was simply not cleared. That is not a verdict either way.
  assert.equal(p.verdict, null);
});

test("elementStatus: the second-judge-unavailable status reads as not evaluated, and is neither verdict", () => {
  const p = elementStatusPresentation("not_evaluated_second_unavailable");
  assert.match(p.label, /not evaluated/i);
  assert.equal(p.verdict, null, "an unevaluated element must not carry a verdict");
  assert.notEqual(p.label, elementStatusPresentation("not_established").label);
});

test("elementStatus: an unknown status fails closed — no verdict, flagged, not a negative finding", () => {
  for (const unreadable of ["", "   ", "ESTABLISHED", "not_established_maybe", "pending", "banana"]) {
    const p = elementStatusPresentation(unreadable);
    assert.equal(p.unknown, true, `"${unreadable}" should be unknown`);
    assert.equal(p.status, null, `"${unreadable}" should carry no canonical status`);
    assert.equal(p.verdict, null, `"${unreadable}" must not assert a verdict`);
    assert.notEqual(
      p.label,
      elementStatusPresentation("not_established").label,
      `"${unreadable}" must not render as the definite negative`,
    );
    assert.equal(isElementStatus(unreadable), false);
  }
});

test("elementStatus: a missing status (null/undefined) fails closed the same way as an empty one", () => {
  for (const missing of [null, undefined]) {
    const p = elementStatusPresentation(missing);
    assert.equal(p.unknown, true);
    assert.equal(p.verdict, null);
  }
  assert.deepEqual(elementStatusPresentation(null), elementStatusPresentation(""));
});

test("elementStatus: exactly two of the four statuses are verdicts", () => {
  const verdicts = ELEMENT_STATUSES.map((s: ElementStatus) => elementStatusPresentation(s).verdict);
  assert.deepEqual(verdicts, ["established", null, "not_established", null]);
});
