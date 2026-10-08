"use client";

import { Loader2, SearchCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { verifyCitation } from "@/lib/api";
import { PREVIEW_LABEL } from "@/lib/citationCheck";
import { runCitationCheck, type CitationCheckState } from "@/lib/citationCheckRun";

/** What a finished (or failed) check shows: the engine's status verbatim with its note, or the honest refusal / invalid-input text. */
export function CitationCheckResult({ state }: { state: CitationCheckState }) {
  return (
    <>
    {(state.phase === "error" || state.phase === "invalid") && (
      <p className="text-red-400" role="alert" data-testid="citation-check-error" data-kind={state.phase === "error" ? state.kind : "invalid"}>
        {state.message}
      </p>
    )}
    {state.phase === "result" && (
      <div data-testid="citation-check-result" className="rounded-md border border-[var(--color-border)] p-2">
        <div className="font-mono text-sm text-[var(--color-text)]" data-testid="citation-check-status">
          {state.view.status || "(no status)"}
        </div>
        {state.view.product && (
          <p className="text-[var(--color-text)]" data-testid="citation-check-product-label">
            {state.view.product.label}
          </p>
        )}
        {!state.view.known && (
          <p className="text-[var(--color-text-dim)]" data-testid="citation-check-unknown">
            The engine sent a status this build does not know; it is shown as sent.
          </p>
        )}
        {state.view.note && (
          <p className="text-[var(--color-text)]" data-testid="citation-check-note">
            {state.view.note}
          </p>
        )}
      </div>
    )}
    </>
  );
}

/** What one citation's check shows. Pure: the state in, markup out (the tests render this). */
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
      <span className="ml-2 text-[11px] text-amber-300" data-testid="citation-check-preview">
        {PREVIEW_LABEL}
      </span>
      <CitationCheckResult state={state} />
    </div>
  );
}

/** One citation and the quote to look for, with its own button and result. Self-contained: it holds no page state. */
export function CitationCheck({ citation, quote }: { citation: string; quote: string }) {
  const [state, setState] = useState<CitationCheckState>({ phase: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const check = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ phase: "checking" });
    const next = await runCitationCheck(verifyCitation, citation, quote, ac.signal);
    if (abortRef.current === ac) setState(next); // a newer run or an unmount owns the state now
  }, [citation, quote]);
  return <CitationCheckView state={state} onCheck={check} citation={citation} />;
}
