import { strict as assert } from "node:assert";
import test from "node:test";

import { chosenFacts, initialSelection, selectionState, toggleFact } from "./factSelection";

test("a tick adds the fact in order; an untick removes it", () => {
  let r = toggleFact([], 3);
  r = toggleFact(r.selected, 1);
  assert.deepEqual(r.selected, [1, 3]);
  assert.equal(r.refused, false);
  assert.deepEqual(toggleFact(r.selected, 3).selected, [1]);
});

test("the ninth tick is refused and nothing else changes; an untick at the limit makes room", () => {
  const eight = [0, 1, 2, 3, 4, 5, 6, 7];
  const refused = toggleFact(eight, 8);
  assert.equal(refused.refused, true);
  assert.deepEqual(refused.selected, eight);
  assert.equal(toggleFact(toggleFact(eight, 0).selected, 8).refused, false);
});

test("the limit is the app's MAX_FACTS (8) by default and can be passed", () => {
  assert.equal(selectionState([0, 1, 2, 3, 4, 5, 6, 7]).limit, 8);
  assert.equal(selectionState([0, 1]).canScreen, true);
  assert.equal(selectionState([]).canScreen, false);
  assert.equal(selectionState([0, 1, 2], 2).canScreen, false);
  assert.equal(selectionState([0, 1], 2).atLimit, true);
});

test("the starting choice is the first eight; fewer facts are all chosen", () => {
  assert.deepEqual(initialSelection(12), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(initialSelection(3), [0, 1, 2]);
  assert.deepEqual(initialSelection(0), []);
});

test("chosen facts keep their original F-numbers and order, whatever order they were ticked in", () => {
  const facts = ["a", "b", "c", "d"];
  assert.deepEqual(chosenFacts(facts, [3, 0]), [{ number: 1, text: "a" }, { number: 4, text: "d" }]);
  assert.deepEqual(chosenFacts(facts, [9]), []);
});

import * as copy from "./factSelectionCopy";

test("the selector's words are R1's exact text (14 Oct)", () => {
  assert.equal(copy.SELECTOR_HEADING, "Choose the facts to screen");
  assert.equal(copy.SELECTOR_TICK_LINE, "Tick up to 8 facts. Screening reads only the ones you choose.");
  assert.equal(copy.SELECTOR_INTRO, "These are your own words, split into numbered pieces. Nothing is rewritten.");
  assert.equal(copy.selectorLimitLine(12), "Intake found 12 facts. Screening takes up to 8 at a time: choose the ones that matter.");
  assert.equal(copy.selectorCounter(0), "0 of 8 chosen");
  assert.equal(copy.selectorCounter(5), "5 of 8 chosen");
  assert.equal(copy.SELECTOR_OVER_LIMIT, "Choose up to 8, or screen in more than one round.");
  assert.equal(copy.SELECTOR_EMPTY, "Choose at least one fact to screen.");
  assert.equal(copy.SELECTOR_SCREEN_BUTTON, "Screen the chosen facts");
});
