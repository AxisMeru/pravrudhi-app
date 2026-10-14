import { MAX_FACTS } from "./factsInput";

// Intake's "choose up to 8 facts" step (Lead-2 option A, 14 Oct): a checkbox list over the numbered facts that intake produced. The engine's cap and the app's MAX_FACTS (8) are
// unchanged; screening takes the chosen facts, in their original order, with their original F-numbers. This file is pure logic: no words, no DOM.

export interface ToggleResult {
  selected: readonly number[];
  /** True when the user ticked a box that would have been the ninth: the tick is not accepted and the view says so (neutrally). */
  refused: boolean;
}

/** Tick or untick fact `index` (0-based). A tick over the limit is refused, never silently dropped elsewhere. The result is sorted ascending so the order of the facts is kept. */
export function toggleFact(selected: readonly number[], index: number, limit: number = MAX_FACTS): ToggleResult {
  if (selected.includes(index)) return { selected: selected.filter((i) => i !== index), refused: false };
  if (selected.length >= limit) return { selected, refused: true };
  return { selected: [...selected, index].sort((a, b) => a - b), refused: false };
}

/** The first `limit` facts, a sensible starting choice when intake produced more than the limit (the user can change it). */
export function initialSelection(factCount: number, limit: number = MAX_FACTS): number[] {
  return Array.from({ length: Math.min(factCount, limit) }, (_, i) => i);
}

/** The chosen facts with their original numbers, in order, ready for screening. */
export function chosenFacts(facts: readonly string[], selected: readonly number[]): { number: number; text: string }[] {
  return [...selected].sort((a, b) => a - b).filter((i) => i >= 0 && i < facts.length).map((i) => ({ number: i + 1, text: facts[i] }));
}

export interface SelectionState {
  count: number;
  limit: number;
  atLimit: boolean;
  /** Screening can run only with at least one and at most `limit` facts chosen. */
  canScreen: boolean;
}

export function selectionState(selected: readonly number[], limit: number = MAX_FACTS): SelectionState {
  return { count: selected.length, limit, atLimit: selected.length >= limit, canScreen: selected.length >= 1 && selected.length <= limit };
}
