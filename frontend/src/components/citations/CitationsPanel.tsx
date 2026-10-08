"use client";

import { Loader2, SearchCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { verifyCitation } from "@/lib/api";
import { PREVIEW_LABEL } from "@/lib/citationCheck";
import { COVERAGE_NOT_REPORTED, MAX_CITATIONS, checkCitations, coverageLine, parseCitationLines, type PanelRow } from "@/lib/citationsPanel";
import { CitationCheckResult } from "./CitationCheck";

/** The coverage line for a finished run: the engine's own field from the first reply that carried one, else the plain fallback. */
export function panelCoverage(rows: readonly PanelRow[]): string {
  for (const r of rows) {
    if (r.state.phase === "result" && r.state.coverage !== undefined) return coverageLine(r.state.coverage);
  }
  return COVERAGE_NOT_REPORTED;
}

/** What the panel shows for a set of rows. Pure: rows in, markup out (the tests render this). */
export function CitationsPanelView({ rows, skipped, coverage }: { rows: readonly PanelRow[]; skipped: number; coverage: string | null }) {
  return (
    <div className="space-y-2" data-testid="citations-panel-results">
      {rows.map((r) => (
        <div key={r.item.line} className="rounded-md border border-[var(--color-border)] p-2 text-sm" data-testid="citations-panel-row">
          <div className="font-mono text-xs text-[var(--color-text)]">{r.item.citation}</div>
          {r.state.phase === "needs_quote" && (
            <p className="mt-1 text-xs text-[var(--color-text-dim)]" data-testid="citations-panel-needs-quote">
              {r.state.message}
            </p>
          )}
          {r.state.phase === "idle" && <p className="mt-1 text-xs text-[var(--color-text-dim)]">Not checked.</p>}
          {r.state.phase !== "needs_quote" && r.state.phase !== "idle" && <CitationCheckResult state={r.state} />}
        </div>
      ))}
      {skipped > 0 && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="citations-panel-skipped">
          {skipped} more line{skipped === 1 ? "" : "s"} not checked: at most {MAX_CITATIONS} at a time.
        </p>
      )}
      {coverage !== null && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="citations-panel-coverage">
          {coverage}
        </p>
      )}
    </div>
  );
}

/**
 * Case citations the user pastes, one per line (`citation` or `citation | quote`), checked against the engine's index one at a time. Self-contained:
 * it holds its own text and results. `initial` pre-fills the lines.
 */
export function CitationsPanel({ initial }: { initial?: string[] }) {
  const [text, setText] = useState((initial ?? []).join("\n"));
  const [rows, setRows] = useState<PanelRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    const parsed = parseCitationLines(text);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setDone(false);
    setSkipped(parsed.skipped);
    setRows([]);
    const finished = await checkCitations(verifyCitation, parsed.items, ac.signal, (r) => {
      if (abortRef.current === ac) setRows(r);
    });
    if (abortRef.current === ac) {
      setRows(finished);
      setBusy(false);
      setDone(true);
    }
  }

  return (
    <section className="space-y-2" aria-labelledby="citations-panel-title" data-testid="citations-panel">
      <h2 id="citations-panel-title" className="text-sm font-medium text-[var(--color-text)]">
        Case citations
      </h2>
      <p className="w-fit rounded-md border border-amber-500/40 px-2 py-0.5 text-xs text-amber-300">{PREVIEW_LABEL}</p>
      <label className="block text-sm text-[var(--color-text)]">
        One citation per line; add the quoted words after a | on the same line
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
          placeholder="(2020) 3 SCC 456 | the words to look for"
        />
      </label>
      <button
        type="button"
        onClick={run}
        disabled={busy || !text.trim()}
        className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <SearchCheck size={14} />}
        {busy ? "Checking…" : "Check citations"}
      </button>
      {(rows.length > 0 || skipped > 0) && <CitationsPanelView rows={rows} skipped={skipped} coverage={done ? panelCoverage(rows) : null} />}
    </section>
  );
}
