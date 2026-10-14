"use client";

import { useState } from "react";

import { toggleFact, selectionState } from "@/lib/factSelection";
import { MAX_FACTS } from "@/lib/factsInput";
import {
  SELECTOR_EMPTY,
  SELECTOR_HEADING,
  SELECTOR_INTRO,
  SELECTOR_OVER_LIMIT,
  SELECTOR_RENUMBER,
  SELECTOR_SCREEN_BUTTON,
  SELECTOR_TICK_LINE,
  selectorCounter,
  selectorLimitLine,
} from "@/lib/factSelectionCopy";

/** Intake's "choose up to 8 facts" step: a checkbox list over the numbered facts with a counter. Screening takes the chosen facts (onScreen). Words: lib/factSelectionCopy.ts. */
export function FactSelector({
  facts,
  selected,
  onChange,
  onScreen,
}: {
  facts: readonly string[];
  selected: readonly number[];
  onChange: (selected: readonly number[]) => void;
  onScreen: () => void;
}) {
  const [refused, setRefused] = useState(false);
  const [triedEmpty, setTriedEmpty] = useState(false);
  const state = selectionState(selected, MAX_FACTS);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-label="Choose facts" data-testid="fact-selector">
      <h2 className="text-base font-medium text-[var(--color-text)]">{SELECTOR_HEADING}</h2>
      <p className="text-sm text-[var(--color-text)]">{SELECTOR_TICK_LINE}</p>
      <p className="text-sm text-[var(--color-text)]">{SELECTOR_INTRO}</p>
      {facts.length > MAX_FACTS && <p className="text-sm text-[var(--color-text)]" data-testid="selector-limit-line">{selectorLimitLine(facts.length)}</p>}
      <ul className="flex flex-col gap-2" aria-label="Facts to choose from">
        {facts.map((f, i) => {
          const checked = selected.includes(i);
          return (
            <li key={i} className="flex items-start gap-2">
              <input
                id={`pick-${i}`}
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={checked}
                onChange={() => {
                  const r = toggleFact(selected, i, MAX_FACTS);
                  setRefused(r.refused);
                  setTriedEmpty(false);
                  if (!r.refused) onChange(r.selected);
                }}
                data-testid={`pick-${i}`}
              />
              <label htmlFor={`pick-${i}`} className="text-sm text-[var(--color-text)]">
                <span className="mr-2 font-mono text-xs text-[var(--color-text-dim)]">F{i + 1}</span>
                {f}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--color-text)]" data-testid="selector-counter" aria-live="polite">{selectorCounter(state.count)}</span>
        <button
          type="button"
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
          data-testid="selector-screen"
          onClick={() => {
            if (!state.canScreen) return setTriedEmpty(true);
            onScreen();
          }}
        >
          {SELECTOR_SCREEN_BUTTON}
        </button>
      </div>
      <p className="text-xs text-[var(--color-text-dim)]" data-testid="selector-renumber">{SELECTOR_RENUMBER}</p>
      {refused && <p className="text-sm text-[var(--color-text)]" role="status" data-testid="selector-over-limit">{SELECTOR_OVER_LIMIT}</p>}
      {triedEmpty && <p className="text-sm text-[var(--color-text)]" role="status" data-testid="selector-empty">{SELECTOR_EMPTY}</p>}
    </section>
  );
}
