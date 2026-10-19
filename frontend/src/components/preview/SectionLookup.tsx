"use client";

import { useState } from "react";

import { previewPost } from "@/lib/previewApi";
import { SECTION_LOOKUP_COPY as C } from "@/lib/sectionLookupCopy";
import { normaliseSection, parseLookup, readingOrder, type LookupBody, type LookupCode, type LookupView } from "@/lib/sectionLookup";

const BTN = "inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const FIELD = "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]";
const DIM = "text-xs text-[var(--color-text-dim)]";

function Body({ b, testid }: { b: LookupBody; testid: string }) {
  return (
    <div className="space-y-1 rounded-md border border-[var(--color-border)] p-3" data-testid={testid}>
      {b.held ? (
        <>
          <div className="text-sm font-medium text-[var(--color-text)]" data-testid={`${testid}-heading`}>{[b.section, b.title].filter(Boolean).join(" · ")}</div>
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-[var(--color-text)]" tabIndex={0} data-testid={`${testid}-text`}>{b.text}</div>
        </>
      ) : null}
      {b.lines.map((l, i) => <p key={i} className={DIM} data-testid={`${testid}-line`}>{l}</p>)}
    </div>
  );
}

/**
 * The Section lookup card (#1016; flag-ON only, OFF by default): old IPC or CrPC section against the NCRB table, read-only. Branches only on the engine's `state`; every sentence is the engine's, shown as sent.
 * Reading order (contract): heading, table source line, state line, OLD left and each NEW in the engine's order (narrow screens: old first, then each new), lawyer line. A non-JSON or unexpected answer reads "not available here".
 */
export function SectionLookup() {
  const [code, setCode] = useState<LookupCode>("IPC");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<LookupView | null>(null);
  const section = normaliseSection(raw);

  async function go(retried = false): Promise<void> {
    if (!section) return;
    setBusy(true); setMessage(null); if (!retried) setView(null);
    try {
      const a = await previewPost("/section-lookup", { code, section });
      if (a.status === 429 && !retried) { await new Promise((r) => setTimeout(r, 2000)); return go(true); }
      if (a.status === 429) { setView(null); return setMessage(C.retry); }
      if (a.status === 422) { setView(null); return setMessage(C.badSection); }
      const v = a.status === 200 ? parseLookup(a.body) : null;
      if (!v) { setView(null); return setMessage(C.unavailable); }
      setView(v);
    } catch { setView(null); setMessage(C.unavailable); } finally { setBusy(false); }
  }

  const bodies = view ? readingOrder(view) : [];
  return (
    <section className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-labelledby="pv-sl-heading" data-testid="pv-sl">
      <h2 id="pv-sl-heading" className="text-base font-medium text-[var(--color-text)]">{C.heading}</h2>
      {view && <p className={DIM} data-testid="pv-sl-source">{view.tableSourceLine}</p>}
      <fieldset className="flex flex-wrap items-center gap-4">
        <legend className="text-sm text-[var(--color-text)]">{C.codeLegend}</legend>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]"><input type="radio" name="pv-sl-code" checked={code === "IPC"} onChange={() => setCode("IPC")} data-testid="pv-sl-ipc" /> {C.codeIpc}</label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]"><input type="radio" name="pv-sl-code" checked={code === "CrPC"} onChange={() => setCode("CrPC")} data-testid="pv-sl-crpc" /> {C.codeCrpc}</label>
      </fieldset>
      <label className="block text-sm text-[var(--color-text)]">{C.sectionLabel}
        <input className={`${FIELD} mt-1 max-w-xs`} value={raw} maxLength={8} inputMode="text" autoComplete="off" onChange={(e) => setRaw(e.target.value)} data-testid="pv-sl-section" />
      </label>
      <button type="button" className={BTN} disabled={busy || !section} onClick={() => void go()} data-testid="pv-sl-run">{C.button}</button>
      {message && <p className="text-sm text-[var(--color-text)]" role="status" data-testid="pv-sl-message">{message}</p>}
      {view && (
        <div className="space-y-3" data-testid="pv-sl-result" data-state={view.state}>
          <p className="text-sm font-medium text-[var(--color-text)]" data-testid="pv-sl-line">{view.line}</p>
          {bodies.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Body b={bodies[0]} testid="pv-sl-old" />
              <div className="space-y-3">{bodies.slice(1).map((b, i) => <Body key={b.id ?? i} b={b} testid={`pv-sl-new-${i}`} />)}</div>
            </div>
          )}
          <p className={DIM} data-testid="pv-sl-lawyer">{view.lawyerLine}</p>
        </div>
      )}
    </section>
  );
}
