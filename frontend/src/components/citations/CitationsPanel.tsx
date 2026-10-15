"use client";

import { Loader2, SearchCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { verifyCitation } from "@/lib/api";
import { CITATION_PLACEHOLDER, PREVIEW_LABEL } from "@/lib/citationCheck";
import { CITATION_EXISTENCE_ONLY, COVERAGE_LIMITS_TEXT, EXISTENCE_PANEL_LINE, QUOTE_NOT_CHECKED_TEXT, SIGNED_OUT_BEFORE_TEXT } from "@/lib/citationExistence";
import { COVERAGE_NOT_REPORTED, MAX_CITATIONS, MAX_CITATIONS_EXISTENCE, batchStopText, checkCitations, coverageLine, overCapText, parseCitationLines, type PanelRow } from "@/lib/citationsPanel";
import { CitationCheckResult } from "./CitationCheck";
import { useSignedOut } from "./useSignedOut";

/** The coverage line for a finished run: the engine's own field from the first reply that carried one, else the plain fallback. */
export function panelCoverage(rows: readonly PanelRow[]): string {
  for (const r of rows) {
    if (r.state.phase === "result" && r.state.coverage !== undefined) return coverageLine(r.state.coverage);
  }
  return COVERAGE_NOT_REPORTED;
}

/**
 * What the panel shows for a set of rows. Pure: rows in, markup out (the tests render this). The results area is a live region (role=status, #223 D6) that exists before any result,
 * so a screen reader announces the answer when it arrives. With the arm ON a run that stopped at the engine's rate limit shows ONE sentence (how many lines were checked and when to try
 * the rest), never the refused row and never the unchecked rows (#223 D5).
 */
export function CitationsPanelView({ rows, skipped, coverage, existenceOnly = CITATION_EXISTENCE_ONLY }: { rows: readonly PanelRow[]; skipped: number; coverage: string | null; existenceOnly?: boolean }) {
  const stopAt = existenceOnly ? rows.findIndex((r) => r.state.phase === "error" && r.state.kind === "rate_limited") : -1;
  const shown = stopAt === -1 ? rows : rows.slice(0, stopAt);
  const limited = stopAt === -1 ? null : rows[stopAt].state;
  const wait = limited && limited.phase === "error" ? limited.wait : undefined;
  const cap = existenceOnly ? MAX_CITATIONS_EXISTENCE : MAX_CITATIONS;
  return (
    <div className="space-y-2" data-testid="citations-panel-results" role="status">
      {shown.map((r) => (
        <div key={r.item.line} className="rounded-md border border-[var(--color-border)] p-2 text-sm" data-testid="citations-panel-row">
          <div className="font-mono text-xs text-[var(--color-text)]">{r.item.citation}</div>
          {r.state.phase === "idle" && <p className="mt-1 text-xs text-[var(--color-text-dim)]">Not checked.</p>}
          {r.state.phase !== "idle" && <CitationCheckResult state={r.state} />}
          {r.item.quoteIgnored && r.state.phase !== "idle" && <p className="mt-1 text-xs text-[var(--color-text-dim)]" data-testid="citations-panel-quote-note">{QUOTE_NOT_CHECKED_TEXT}</p>}
        </div>
      ))}
      {limited && (
        <p className="text-sm text-[var(--color-text)]" data-testid="citations-panel-rate-stop">
          {batchStopText(stopAt, rows.length, wait)}
        </p>
      )}
      {skipped > 0 && existenceOnly && !limited && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="citations-panel-skipped">
          {overCapText(cap)}
        </p>
      )}
      {skipped > 0 && !existenceOnly && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="citations-panel-skipped">
          {skipped} more line{skipped === 1 ? "" : "s"} not checked: at most {cap} at a time.
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
  const signedOut = useSignedOut();

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
      <p className="w-fit rounded-md border border-[var(--color-warn-border)] px-2 py-0.5 text-xs text-[var(--color-warn)]">{PREVIEW_LABEL}</p>
      {CITATION_EXISTENCE_ONLY && signedOut && (
        <p className="text-sm text-[var(--color-text)]" data-testid="citations-panel-signed-out">
          {SIGNED_OUT_BEFORE_TEXT}
        </p>
      )}
      <label className="block text-sm text-[var(--color-text)]">
        {CITATION_EXISTENCE_ONLY ? `One citation per line, at most ${MAX_CITATIONS_EXISTENCE} at a time. ${EXISTENCE_PANEL_LINE}` : "One citation per line. To check that words appear in the case, add them after a | on the same line; without them only the citation is looked up."}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
          placeholder={CITATION_EXISTENCE_ONLY ? CITATION_PLACEHOLDER : `${CITATION_PLACEHOLDER} | the words to look for`}
        />
      </label>
      {CITATION_EXISTENCE_ONLY && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="citations-panel-limits">
          {COVERAGE_LIMITS_TEXT}
        </p>
      )}
      <button
        type="button"
        onClick={run}
        disabled={busy || !text.trim()}
        className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-accent)] disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <SearchCheck size={14} />}
        {busy ? "Checking…" : "Check citations"}
      </button>
      {rows.length > 0 || skipped > 0 ? (
        <CitationsPanelView rows={rows} skipped={skipped} coverage={done ? panelCoverage(rows) : null} />
      ) : (
        <div role="status" data-testid="citations-panel-live" />
      )}
    </section>
  );
}
