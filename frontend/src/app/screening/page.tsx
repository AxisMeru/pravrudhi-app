"use client";

// The Screening view (O8, #830): paste or upload the facts, pick the offence, see which ingredients the facts support. The checklist is the hero;
// every new string is in lib/screening/copy.ts (R1 reviews that list). The engine's decisions are shown in plain words and never changed here.
import { Loader2, ScanSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CaveatStrip } from "@/components/CaveatStrip";
import { CitationsPanel } from "@/components/citations/CitationsPanel";
import { PageHeader } from "@/components/PageHeader";
import { FrontierToggle } from "@/components/screening/FrontierToggle";
import { IngredientChecklist } from "@/components/screening/IngredientChecklist";
import { StatuteNotice } from "@/components/StatuteNotice";
import { ApiError, analyseFacts, nyayaRegistryContracts, nyayaRegistryEntries, type AnalyseFactsResult } from "@/lib/api";
import { NO_CONTRACTS_MESSAGE, pickerState } from "@/lib/contractsPicker";
import { IS_DEMO } from "@/lib/api";
import { checkFacts, extractText, fileKind, UNREADABLE_MESSAGE } from "@/lib/factsInput";
import { buildAuditTrail, buildScreeningMemo } from "@/lib/screening/memo";
import { splitIntoFacts } from "@/lib/screening/facts";
import { OFFENCES } from "@/lib/screening/offences";
import { SCREENING_SUBTITLE, SCREENING_TITLE } from "@/lib/screening/copy";
import { classifyAnalyseError, fetchServiceStatus, formatNextOpen, isClosed, type StatusResult } from "@/lib/serviceStatus";
import { FILE_NOTE, PRE_SUBMIT_RETENTION, validatedById, validationLabel, validationMark } from "@/lib/surfaceCopy";

const SLOW_START_SECONDS = 200;

function download(name: string, body: string, type: string): void {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ScreeningPage() {
  const [paste, setPaste] = useState("");
  const [facts, setFacts] = useState<string[]>([""]);
  const [contracts, setContracts] = useState<string[]>([]);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [contractsTry, setContractsTry] = useState(0);
  const [validated, setValidated] = useState<Map<string, boolean> | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [frontier, setFrontier] = useState(false);
  const [result, setResult] = useState<AnalyseFactsResult | null>(null);
  const [request, setRequest] = useState<{ facts: string[]; contractIds: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [svc, setSvc] = useState<StatusResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const closed = svc?.kind === "ok" && isClosed(svc.status);
  const offline = svc?.kind === "offline";
  const picker = pickerState(contractsLoaded, contractsError !== null, contracts.length, IS_DEMO);

  useEffect(() => {
    let off = false;
    const poll = () => fetchServiceStatus().then((r) => !off && setSvc(r));
    poll();
    const id = window.setInterval(poll, 30_000);
    return () => {
      off = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let off = false;
    nyayaRegistryEntries().then((e) => !off && setValidated(validatedById(e))).catch(() => !off && setValidated(null));
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    let off = false;
    nyayaRegistryContracts()
      .then((cs) => {
        if (off) return;
        setContractsError(null);
        setContracts(cs);
        setContractsLoaded(true);
      })
      .catch((e: unknown) => {
        if (!off) setContractsError(e instanceof ApiError ? `Could not reach the engine's registry API (${e.status}).` : "Could not load contracts.");
      });
    return () => {
      off = true;
    };
  }, [contractsTry]);

  const offered = OFFENCES.map((o) => ({ o, ids: o.contracts.filter((c) => contracts.includes(c)) })).filter((x) => x.ids.length > 0);

  async function submit() {
    const cleaned = facts.map((f) => f.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
    const check = checkFacts(cleaned.join("\n"));
    if (!check.ok) return setError(check.message);
    const ids = Array.from(picked);
    if (ids.length === 0) return setError("Pick at least one offence to screen for.");
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsed(0);
    const ticker = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r = await analyseFacts(check.facts, ids, undefined, ac.signal);
      setRequest({ facts: check.facts, contractIds: ids });
      setResult(r);
    } catch (e) {
      const c = classifyAnalyseError(e);
      setError(c.message);
      if (c.kind === "outside_window") fetchServiceStatus().then(setSvc);
    } finally {
      window.clearInterval(ticker);
      abortRef.current = null;
      setLoading(false);
    }
  }

  const version = svc?.kind === "ok" ? svc.status.engine_version : null;
  const opts = () => ({ engineVersion: version, generatedAt: new Date().toISOString() });

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title={SCREENING_TITLE} subtitle={SCREENING_SUBTITLE} />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-8">
        <CaveatStrip retentionNotice={result?.retention_notice} warming={svc?.kind === "ok" && svc.status.judge.state === "warming"} />
        <section className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-label="Facts">
          <p className="text-xs text-[var(--color-text-dim)]" data-testid="retention-before">{PRE_SUBMIT_RETENTION}</p>
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="screening-paste">Paste the FIR, complaint or narrative</label>
          <textarea
            id="screening-paste"
            className="min-h-[100px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".txt,.pdf,.docx"
              aria-label="Load facts from a file"
              data-testid="facts-file"
              className="text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                let parsers = {};
                if (fileKind(file.name) !== "txt") {
                  try {
                    parsers = (await import("@/lib/docParsers")).browserParsers;
                  } catch {
                    return setError(UNREADABLE_MESSAGE);
                  }
                }
                const r = await extractText(file, parsers);
                if (r.ok) {
                  setPaste(r.text);
                  setError(null);
                } else setError(r.message);
              }}
            />
            <button
              type="button"
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
              data-testid="split-facts"
              onClick={() => {
                const parts = splitIntoFacts(paste);
                if (parts.length > 0) setFacts(parts);
              }}
            >
              Split into numbered facts
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-dim)]">{FILE_NOTE}</p>
          <ol className="flex flex-col gap-2" aria-label="Numbered facts" data-testid="fact-list">
            {facts.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-2 w-8 shrink-0 font-mono text-xs text-[var(--color-text-dim)]">F{i + 1}</span>
                <textarea
                  aria-label={`Fact F${i + 1}`}
                  className="min-h-[44px] flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]"
                  value={f}
                  onChange={(e) => setFacts((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button
                  type="button"
                  className="mt-1 text-xs text-[var(--color-text-dim)] underline"
                  aria-label={`Remove fact F${i + 1}`}
                  onClick={() => setFacts((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [""]))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="w-fit text-sm text-[var(--color-text-dim)] underline" onClick={() => setFacts((p) => [...p, ""])}>
            Add a fact
          </button>

          <fieldset className="mt-2 flex flex-col gap-2">
            <legend className="text-sm font-medium text-[var(--color-text)]">What to screen for</legend>
            {picker === "error" ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-red-400" role="alert" data-testid="contracts-error">{contractsError}</p>
                <button type="button" className="text-sm text-[var(--color-text-dim)] underline" data-testid="contracts-retry" onClick={() => { setContractsError(null); setContractsTry((n) => n + 1); }}>
                  Try again
                </button>
              </div>
            ) : picker === "empty" ? (
              <p className="text-sm text-amber-400" role="status" data-testid="contracts-empty">{NO_CONTRACTS_MESSAGE}</p>
            ) : picker === "loading" ? (
              <p className="text-sm text-[var(--color-text-dim)]" role="status">Loading…</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="offence-list">
                {offered.map(({ o, ids }) => {
                  const on = ids.every((i) => picked.has(i));
                  return (
                    <li key={o.id}>
                      <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${on ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"}`}>
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={on}
                          onChange={() => setPicked((prev) => {
                            const next = new Set(prev);
                            for (const i of ids) {
                              if (on) next.delete(i);
                              else next.add(i);
                            }
                            return next;
                          })}
                        />
                        <span>
                          <span className="text-[var(--color-text)]">{o.title}</span>
                          <span className="ml-2 text-xs text-[var(--color-text-dim)]">{o.sections}</span>
                          {ids.some((i) => validationLabel(validationMark(validated, i))) && (
                            <span className="ml-2 text-xs text-amber-300">({validationLabel(validationMark(validated, ids[0]))})</span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <FrontierToggle value={frontier} onChange={setFrontier} available={null} />

          <button
            type="button"
            onClick={submit}
            disabled={loading || closed || offline}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
            {loading ? "Screening…" : "Screen these facts"}
          </button>
          {closed && svc?.kind === "ok" && svc.status.service_window && (
            <p className="text-sm text-amber-400" role="status" data-testid="screening-offline">
              The hosted demo is offline outside its service hours ({formatNextOpen(svc.status.service_window)}). Nothing is sent while it is closed.
            </p>
          )}
          {offline && (
            <p className="text-sm text-amber-400" role="status" data-testid="screening-engine-offline">
              The engine is not answering right now. Nothing is sent until it is back.
            </p>
          )}
          {loading && (
            <>
              <button type="button" onClick={() => abortRef.current?.abort()} data-testid="screening-cancel" className="w-fit text-sm text-[var(--color-text-dim)] underline">
                Cancel
              </button>
              <p className="text-sm text-[var(--color-text-dim)]" aria-live="polite">
                Warming up the judge and Lean checker — a first run after idle can take about 3 minutes.{" "}
                <span className="font-mono">{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span> elapsed.
              </p>
            </>
          )}
          {loading && elapsed >= SLOW_START_SECONDS && (
            <p className="text-sm text-amber-400" role="status">
              This is taking longer than a normal start. The analysis models may be switched off at the moment. You can cancel and try again later; no result is returned until they answer.
            </p>
          )}
          {error && <p className="text-sm text-red-400" role="alert" data-testid="screening-error">{error}</p>}
        </section>

        {result && request && (
          <div className="flex flex-col gap-6" data-testid="screening-result">
            <div className="text-xs text-[var(--color-text-dim)]">run {result.run_id} · score sha <span className="font-mono">{result.score_sha256}</span></div>
            <div className="flex flex-wrap gap-2 print:hidden" data-testid="memo-actions">
              <button type="button" className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" onClick={() => download(`screening-memo-${result.run_id}.md`, buildScreeningMemo(result, opts()), "text/markdown")}>
                Download memo (.md)
              </button>
              <button type="button" className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" onClick={() => window.print()}>
                Print / save as PDF
              </button>
              <button type="button" className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" onClick={() => download(`audit-trail-${result.run_id}.json`, buildAuditTrail(request, result, opts()), "application/json")}>
                Download audit trail (.json)
              </button>
            </div>
            {result.contracts.map((c) => (
              <IngredientChecklist key={c.contract_id} contract={c} facts={result.facts} />
            ))}
            <CitationsPanel />
            <StatuteNotice />
          </div>
        )}
      </div>
    </div>
  );
}
