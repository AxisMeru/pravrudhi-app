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

test("elementStatus: the five canonical statuses each get a distinct label and a distinct tone", () => {
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
  assert.equal(ELEMENT_STATUSES.length, 5, "the canonical status list changed — review the mapping and these tests");
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

test("elementStatus: exactly two of the five statuses are verdicts", () => {
  const verdicts = ELEMENT_STATUSES.map((s: ElementStatus) => elementStatusPresentation(s).verdict);
  assert.deepEqual(verdicts, ["established", null, "not_established", null, null]);
});

// The operator's requirement for the fifth status (2026-09-26) was not "it has a label" but "it renders
// distinctly from BOTH not_established and not_evaluated_second_unavailable" — three visibly different
// presentations, not two. A test that only checked the new label existed would still pass if the new status
// shared the second-judge tone, which is exactly the failure named. So this derives what the badge actually
// renders from — the label and the tone string the component puts in className — and compares those.
function renderedPresentation(status: ElementStatus): string {
  const p = elementStatusPresentation(status);
  // Everything a reader can tell apart: the words, the style token, and whether it asserts a finding.
  return JSON.stringify([p.label, p.tone, p.verdict]);
}

test("elementStatus: all five statuses render as five distinct presentations", () => {
  const rendered = ELEMENT_STATUSES.map(renderedPresentation);
  assert.equal(
    new Set(rendered).size,
    5,
    `two statuses render identically: ${JSON.stringify(rendered, null, 2)}`,
  );
  // Label and tone must each be distinct on their own, not merely distinct in combination — a shared tone
  // with differing labels would still look the same at a glance, which is what the decision rules out.
  assert.equal(new Set(ELEMENT_STATUSES.map((s) => elementStatusPresentation(s).label)).size, 5);
  assert.equal(new Set(ELEMENT_STATUSES.map((s) => elementStatusPresentation(s).tone)).size, 5);
});

test("elementStatus: not_established, second-unavailable and gate1-unavailable differ pairwise", () => {
  const three: ElementStatus[] = [
    "not_established",
    "not_evaluated_second_unavailable",
    "not_evaluated_gate1_unavailable",
  ];
  for (let i = 0; i < three.length; i += 1) {
    for (let j = i + 1; j < three.length; j += 1) {
      const a = elementStatusPresentation(three[i]);
      const b = elementStatusPresentation(three[j]);
      assert.notEqual(a.label, b.label, `${three[i]} and ${three[j]} share a label`);
      assert.notEqual(a.tone, b.tone, `${three[i]} and ${three[j]} share a tone`);
    }
  }
  // And none of the three may look like the fails-closed unknown presentation either.
  const unknown = elementStatusPresentation("banana");
  for (const status of three) {
    assert.notEqual(elementStatusPresentation(status).tone, unknown.tone);
    assert.notEqual(elementStatusPresentation(status).label, unknown.label);
  }
});

test("elementStatus: gate1-unavailable reads as not evaluated, names the entailment check, is no verdict", () => {
  const p = elementStatusPresentation("not_evaluated_gate1_unavailable");
  assert.equal(p.label, "not evaluated — entailment check unavailable");
  assert.match(p.label, /not evaluated/i);
  assert.match(p.label, /entailment check/i);
  assert.equal(p.verdict, null, "an element Gate 1 never checked must not carry a verdict");
  assert.equal(p.unknown, false, "a known status must not be flagged unreadable");
  assert.equal(p.status, "not_evaluated_gate1_unavailable");
});

test("elementStatus: an unknown status still fails closed now that a fifth status exists", () => {
  // The fifth status is a recognised value; the sixth the engine might invent is not, and must keep landing
  // in the error state rather than borrowing the new presentation.
  for (const unreadable of ["not_evaluated_gate1", "gate1_unavailable", "not_evaluated"]) {
    const p = elementStatusPresentation(unreadable);
    assert.equal(p.unknown, true, `"${unreadable}" should be unknown`);
    assert.equal(p.status, null);
    assert.equal(p.verdict, null);
    assert.notEqual(
      p.label,
      elementStatusPresentation("not_evaluated_gate1_unavailable").label,
      `"${unreadable}" must not borrow the gate-1 presentation`,
    );
  }
});
