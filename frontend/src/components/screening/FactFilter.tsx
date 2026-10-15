"use client";

import { FACTS_HEADING, FACT_FILTER_CLEAR, FACT_FILTER_HINT, factFilterStatus } from "@/lib/screening/copy";

/**
 * The facts of a result as a list of buttons: selecting one narrows the ingredient rows below to the rows that cite it (the filter lives in the page, per result; nothing is stored).
 * Keyboard: each fact is a button (aria-pressed); "Show all rows" clears. The status line is a polite live region.
 */
export function FactFilter({ facts, selected, onSelect }: { facts: ReadonlyArray<{ id: string; text: string }>; selected: string | null; onSelect: (id: string | null) => void }) {
  return (
    <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 print:hidden" aria-labelledby="fact-filter-heading" data-testid="fact-filter">
      <h2 id="fact-filter-heading" className="font-serif text-lg font-semibold text-[var(--color-text)]">{FACTS_HEADING}</h2>
      <p className="text-sm text-[var(--color-text-dim)]" data-testid="fact-filter-hint">{FACT_FILTER_HINT}</p>
      <ul className="space-y-2">
        {facts.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              aria-pressed={selected === f.id}
              onClick={() => onSelect(selected === f.id ? null : f.id)}
              className={`flex min-h-8 w-full items-start gap-3 rounded-md border p-2 text-left text-sm max-md:min-h-11 ${selected === f.id ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]" : "border-[var(--color-border)] bg-[var(--color-surface)]"} text-[var(--color-text)]`}
              data-testid={`fact-filter-${f.id}`}
            >
              <span className="mt-0.5 w-8 shrink-0 font-mono text-xs text-[var(--color-text-dim)]">{f.id}</span>
              <span className="whitespace-pre-wrap">{f.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        {selected !== null && (
          <button type="button" onClick={() => { const prev = selected; onSelect(null); /* the clear button unmounts: focus goes to the fact that was selected, not to the page */ requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="fact-filter-${prev}"]`)?.focus()); }} className="inline-flex min-h-8 items-center rounded-md border border-[var(--color-control-border)] px-3 text-sm text-[var(--color-text)] max-md:min-h-11" data-testid="fact-filter-clear">
            {FACT_FILTER_CLEAR}
          </button>
        )}
        <p className="text-sm text-[var(--color-text-dim)]" role="status" data-testid="fact-filter-status">{factFilterStatus(selected)}</p>
      </div>
    </section>
  );
}
