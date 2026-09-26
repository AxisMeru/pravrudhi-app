"use client";

// The matters page: enter the facts of a real situation, get back — per selected contract — which elements
// the house judge found established, the quoted evidence behind each one, Lean's structural check (the right
// element set, nothing about the facts or quotes themselves) and the exact score sha that produced it, and a
// REFER banner when the outcome says a lawyer should look at this rather than the page. Calls POST
// /api/v1/analyse-facts (L4, docs/decisions/LEG-PLAN-2026-09-23.md) through
// analyseFacts() in lib/api.ts — the same path an anonymous product-edition visitor uses, at the engine's own
// shared rate limit; this page adds no auth gate of its own (api.ts's engineFetch already omits the bearer
// token when there is no session, so an anonymous call here is a real anonymous call, not a canned demo).

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, Scale, XCircle } from "lucide-react";
import { analyseFacts, nyayaRegistryContracts, ApiError, type AnalyseFactsContract, type AnalyseFactsResult } from "@/lib/api";
import { elementStatusPresentation } from "@/lib/elementStatus";
import { PageHeader } from "@/components/PageHeader";

// A contract's judge is ABSTAIN with a reason containing this token when no judge has been trained on its
// statute text yet (Lead-2, 2026-09-24: 12 of the 26 registry contracts are in this state today — bns316/
// 318/217/80/108, bnss187, ni138 among them). Matched on the reason string rather than a separate response
// field because that's what the engine actually sends; if the engine later adds a typed field for this, prefer
// it over the string match.
const UNCOVERED_REASON_TOKEN = "no_training_statute_text";

const OUTCOME: Record<string, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  PROOF: { label: "established", tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10", Icon: CheckCircle2 },
  DENIAL: { label: "not established", tone: "text-red-400 border-red-500/40 bg-red-500/10", Icon: XCircle },
  ABSTAIN: { label: "abstained", tone: "text-sky-400 border-sky-500/40 bg-sky-500/10", Icon: HelpCircle },
  REFER_TO_LAWYER: { label: "refer to a lawyer", tone: "text-amber-400 border-amber-500/40 bg-amber-500/10", Icon: AlertTriangle },
};

function isUncovered(c: AnalyseFactsContract): boolean {
  return c.outcome === "ABSTAIN" && c.reason.includes(UNCOVERED_REASON_TOKEN);
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const o = OUTCOME[outcome] ?? { label: outcome, tone: "text-[var(--color-text-dim)] border-[var(--color-border)]", Icon: HelpCircle };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${o.tone}`}>
      <o.Icon size={13} /> {o.label}
    </span>
  );
}

function ElementRow({ el }: { el: AnalyseFactsContract["elements"][number] }) {
  // Label and tone come from lib/elementStatus.ts, not from a boolean here: the engine has four statuses and
  // an unrecognised one must not be shown as a definite negative (AxisMeru/pravrudhi#37).
  const status = elementStatusPresentation(el.status);
  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="py-2 pr-3 align-top text-sm text-[var(--color-text)]">{el.element}</td>
      <td className="py-2 pr-3 align-top">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${status.tone}`}
        >
          {status.label}
        </span>
        {el.p_established !== null && (
          <span className="ml-1.5 text-[11px] text-[var(--color-text-dim)]">p={el.p_established.toFixed(2)}</span>
        )}
      </td>
      <td className="py-2 align-top text-sm text-[var(--color-text-dim)]">
        {el.quote ? (
          <>
            <span className="italic">&ldquo;{el.quote}&rdquo;</span>
            {el.quote_source && <span className="ml-1.5 text-[11px]">— {el.quote_source}</span>}
          </>
        ) : el.error ? (
          <span className="text-red-400">{el.error}</span>
        ) : (
          <span>no quoted evidence</span>
        )}
      </td>
    </tr>
  );
}

function ContractResult({ c }: { c: AnalyseFactsContract }) {
  if (isUncovered(c)) {
    return (
      <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <header className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-[var(--color-text)]">{c.contract_id}</div>
          <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-dim)]">not yet covered</span>
        </header>
        <p className="mt-2 text-sm text-[var(--color-text-dim)]">
          No judge has been trained on this contract&apos;s statute text yet — this is a gap in coverage, not a
          failed or wrong answer. Ask about a different matter, or check back once this contract is trained.
        </p>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-[var(--color-text)]">{c.contract_id}</div>
        <OutcomeBadge outcome={c.outcome} />
      </header>

      {c.outcome === "REFER_TO_LAWYER" && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
          This matter should be reviewed by a lawyer — the judge could not reach a confident established/not-established
          reading on every element from the facts given.
        </div>
      )}

      {c.elements.length > 0 && (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-xs text-[var(--color-text-dim)]">
              <th className="pb-1 pr-3 font-medium">element</th>
              <th className="pb-1 pr-3 font-medium">status</th>
              <th className="pb-1 font-medium">quoted evidence</th>
            </tr>
          </thead>
          <tbody>
            {c.elements.map((el, i) => (
              <ElementRow key={`${el.element}-${i}`} el={el} />
            ))}
          </tbody>
        </table>
      )}

      {c.lean && (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs">
          <div className="font-medium text-[var(--color-text)]">
            Lean structural check: {c.lean_outcome ?? c.lean.verdict}
          </div>
          <div className="mt-1 text-[var(--color-text-dim)]">
            Lean checks that the right elements for this contract were addressed — it does not read the facts
            or quotes. The element findings above come from the judge and are quote-checked against the facts
            you supplied.
          </div>
          {c.lean.denied_claims.length > 0 && <div className="mt-1 text-[var(--color-text-dim)]">denied: {c.lean.denied_claims.join(", ")}</div>}
          {c.lean.unlicensed_claims.length > 0 && <div className="mt-1 text-[var(--color-text-dim)]">unlicensed: {c.lean.unlicensed_claims.join(", ")}</div>}
          {c.lean.omitted_claims.length > 0 && <div className="mt-1 text-[var(--color-text-dim)]">omitted: {c.lean.omitted_claims.join(", ")}</div>}
        </div>
      )}

      {!isUncovered(c) && c.reason && <p className="text-xs text-[var(--color-text-dim)]">{c.reason}</p>}
    </article>
  );
}

export default function MattersPage() {
  const [contracts, setContracts] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [factsText, setFactsText] = useState("");
  const [narrative, setNarrative] = useState("");
  const [result, setResult] = useState<AnalyseFactsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contractsError, setContractsError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    nyayaRegistryContracts()
      .then((cs) => {
        if (off) return;
        setContracts(cs);
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
    try {
      const r = await analyseFacts(facts, Array.from(selected), narrative);
      setResult(r);
    } catch (e) {
      setError(e instanceof ApiError ? `Could not reach the engine's analyse-facts API (${e.status}).` : "Could not analyse these facts.");
    } finally {
      window.clearInterval(ticker);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Matters" subtitle="Enter the facts of a situation and check them against the registry's compiled contracts." />
      <div className="flex flex-1 flex-col gap-6 p-8">
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
            disabled={loading}
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
            {loading ? "Analysing…" : "Analyse"}
          </button>
          {loading && (
            <p className="text-sm text-[var(--color-text-dim)]" aria-live="polite">
              Warming up the judge and Lean checker — first run can take about 3 minutes.{" "}
              <span className="font-mono">
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}
              </span>{" "}
              elapsed.
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {result && (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-[var(--color-text-dim)]">
              run {result.run_id} · score sha <span className="font-mono">{result.score_sha256}</span>
            </div>
            {result.contracts.map((c) => (
              <ContractResult key={c.contract_id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
