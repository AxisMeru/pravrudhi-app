"use client";

import { Loader2, SearchCheck } from "lucide-react";

import { PREVIEW_LABEL, statusLabel } from "@/lib/citationCheck";
import type { CitationCheckState } from "@/lib/citationCheckRun";

/** What a finished (or failed) check shows: the engine's status verbatim with its note, or the honest refusal / invalid-input text. */
/** announce=false inside a panel whose results area is already a live region (role=status): a nested role=alert would make a screen reader say the same sentence twice (#279). */
export function CitationCheckResult({ state, announce = true }: { state: CitationCheckState; announce?: boolean }) {
  return (
    <>
    {(state.phase === "error" || state.phase === "invalid") && (
      <p className="text-[var(--color-danger)]" role={announce ? "alert" : undefined} data-testid="citation-check-error" data-kind={state.phase === "error" ? state.kind : "invalid"}>
        {state.message}
      </p>
    )}
    {state.phase === "result" && (
      <div data-testid="citation-check-result" className="rounded-md border border-[var(--color-border)] p-2">
        <div className="font-mono text-sm text-[var(--color-text)]" data-testid="citation-check-status">
          {statusLabel(state.view.status) || "(no status)"}
        </div>
        {state.view.product && (
          <p className="text-[var(--color-text)]" data-testid="citation-check-product-label">
            {state.view.product.label}
          </p>
        )}
        {state.view.note && (
          <p className="text-[var(--color-text)]" data-testid="citation-check-note">
            {state.view.note}
          </p>
        )}
            {state.view.nameNote && (
              <p className="text-[var(--color-text)]" data-testid="citation-check-name-note">
                {state.view.nameNote}
              </p>
            )}
      </div>
    )}
    </>
  );
}

/** What one citation's check shows. Pure: the state in, markup out (the tests render this). The panel (CitationsPanel) is the one caller that runs checks; no component here sends a quote on its own (R2, 14 Oct). */
export function CitationCheckView({ state, onCheck, citation }: { state: CitationCheckState; onCheck: () => void; citation: string }) {
  const checking = state.phase === "checking";
  return (
    <div className="space-y-1 text-xs" data-testid="citation-check">
      <button
        type="button"
        onClick={onCheck}
        disabled={checking}
        aria-label={`Check this citation: ${citation}`}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] disabled:opacity-50"
      >
        {checking ? <Loader2 size={12} className="animate-spin" /> : <SearchCheck size={12} />}
        {checking ? "Checking…" : "Check this citation"}
      </button>
      <span className="ml-2 text-[11px] text-[var(--color-warn)]" data-testid="citation-check-preview">
        {PREVIEW_LABEL}
      </span>
      <CitationCheckResult state={state} />
    </div>
  );
}
