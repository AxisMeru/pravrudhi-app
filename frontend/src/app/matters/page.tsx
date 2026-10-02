"use client";

// The matters page: enter the facts of a real situation, get back — per selected contract — which elements
// the house judge found established, the verbatim quote each one cites (quote-checked against the submitted
// facts, highlighted at the engine's returned offsets; not checked for relevance), Lean's structural check (the right element set, nothing about the facts
// or quotes themselves) and the exact score sha that produced it, and a
// REFER banner when the outcome says a lawyer should look at this rather than the page. Calls POST
// /api/v1/analyse-facts (L4, docs/decisions/LEG-PLAN-2026-09-23.md) through
// analyseFacts() in lib/api.ts — the same path an anonymous product-edition visitor uses, at the engine's own
// shared rate limit; this page adds no auth gate of its own (api.ts's engineFetch already omits the bearer
// token when there is no session, so an anonymous call here is a real anonymous call, not a canned demo).

import { useEffect, useRef, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { analyseFacts, nyayaRegistryListing, ApiError, type AnalyseFactsResult } from "@/lib/api";
import { coverageById } from "@/lib/matterResults";
import { ContractResult } from "@/components/matters/ContractResult";
import { classifyAnalyseError, fetchServiceStatus, formatNextOpen, isClosed, type StatusResult } from "@/lib/serviceStatus";
import { PageHeader } from "@/components/PageHeader";

export default function MattersPage() {
  const [contracts, setContracts] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<Map<string, boolean> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [factsText, setFactsText] = useState("");
  const [narrative, setNarrative] = useState("");
  const [result, setResult] = useState<AnalyseFactsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [svc, setSvc] = useState<StatusResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const closed = svc?.kind === "ok" && isClosed(svc.status);
  const offline = svc?.kind === "offline";

  useEffect(() => {
    let off = false;
    const poll = () => {
      fetchServiceStatus().then((r) => {
        if (!off) setSvc(r);
      });
    };
    poll();
    const id = window.setInterval(poll, 30_000);
    return () => {
      off = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let off = false;
    nyayaRegistryListing()
      .then((l) => {
        if (off) return;
        setContracts(l.contracts);
        setCoverage(coverageById(l.entries));
      })
      .catch((e: unknown) => {
        if (off) return;
        setContractsError(e instanceof ApiError ? `Could not reach the engine's registry API (${e.status}).` : "Could not load contracts.");
      });
    return () => {
      off = true;
    };
  }, []);

  function toggleContract(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    const facts = factsText
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    if (facts.length === 0 || selected.size === 0) {
      setError("Enter at least one fact and select at least one contract.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsedSeconds(0);
    // Real ticking clock, not a spinner that could look hung: the operator's decision (2026-09-24, no warm
    // workers while we build) means a real cold start here can run ~2.5 minutes (~24s engine start + ~200s
    // judge cold start) -- see the "Warming up" copy below, which reads this same counter.
    const ticker = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r = await analyseFacts(facts, Array.from(selected), narrative, ac.signal);
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

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Matters" subtitle="Enter the facts of a situation and check them against the registry's compiled contracts." />
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="matters-facts">
            Facts (one per line)
          </label>
          <textarea
            id="matters-facts"
            className="min-h-[120px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]"
            placeholder={"The cheque for Rs. 50,000 was dishonoured on presentment.\nThe payee sent a demand notice within 30 days of the return memo."}
            value={factsText}
            onChange={(e) => setFactsText(e.target.value)}
          />
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="matters-narrative">
            Narrative <span className="font-normal text-[var(--color-text-dim)]">(optional, but the judge does better with one)</span>
          </label>
          <textarea
            id="matters-narrative"
            className="min-h-[80px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]"
            placeholder="Describe what happened in your own words, with as much context as you have."
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-[var(--color-text)]">Contracts to check against</legend>
            {contractsError ? (
              <p className="text-sm text-red-400">{contractsError}</p>
            ) : contracts.length === 0 ? (
              <p className="text-sm text-[var(--color-text-dim)]">Loading…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {contracts.map((id) => (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                      selected.has(id) ? "border-[var(--color-accent)] text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-dim)]"
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={selected.has(id)} onChange={() => toggleContract(id)} />
                    {id}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <button
            type="button"
            onClick={submit}
            disabled={loading || closed || offline}
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
            {loading ? "Analysing…" : "Analyse"}
          </button>
          {closed && svc?.kind === "ok" && svc.status.service_window && (
            <p className="text-sm text-amber-400" role="status" data-testid="matters-offline">
              The hosted demo is offline outside its service hours ({formatNextOpen(svc.status.service_window)}). Nothing is sent
              while it is closed.
            </p>
          )}
          {offline && (
            <p className="text-sm text-amber-400" role="status" data-testid="matters-engine-offline">
              The engine is not answering right now. Nothing is sent until it is back.
            </p>
          )}
          {loading && (
            <button type="button" onClick={cancel} data-testid="matters-cancel" className="w-fit text-sm text-[var(--color-text-dim)] underline">
              Cancel
            </button>
          )}
          {loading && (
            <p className="text-sm text-[var(--color-text-dim)]" aria-live="polite">
              Warming up the judge and Lean checker — first run can take about 3 minutes.{" "}
              <span className="font-mono">
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}
              </span>{" "}
              elapsed.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-400" role="alert" data-testid="matters-error">
              {error}
            </p>
          )}
        </div>

        {result && (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-[var(--color-text-dim)]">
              run {result.run_id} · score sha <span className="font-mono">{result.score_sha256}</span>
            </div>
            {result.contracts.map((c) => (
              <ContractResult key={c.contract_id} c={c} facts={result.facts} coverage={coverage} standard={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
