"use client";

// The matters page: enter the facts of a real situation, get back — per selected contract — which elements
// the house judge found established, the verbatim quote each one cites (quote-checked against the submitted
// facts, not checked for relevance), Lean's structural check (the right element set, nothing about the facts
// or quotes themselves) and the exact score sha that produced it, and a
// REFER banner when the outcome says a lawyer should look at this rather than the page. Calls POST
// /api/v1/analyse-facts (L4, docs/decisions/LEG-PLAN-2026-09-23.md) through
// analyseFacts() in lib/api.ts — the same path an anonymous product-edition visitor uses, at the engine's own
// shared rate limit; this page adds no auth gate of its own (api.ts's engineFetch already omits the bearer
// token when there is no session, so an anonymous call here is a real anonymous call, not a canned demo).

import { checkFacts, extractText, fileKind, UNREADABLE_MESSAGE } from "@/lib/factsInput";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, Scale, XCircle } from "lucide-react";
import { analyseFacts, nyayaRegistryContracts, nyayaRegistryEntries, ApiError, type AnalyseFactsContract, type AnalyseFactsResult } from "@/lib/api";
import { elementStatusPresentation } from "@/lib/elementStatus";
import { buildMemo } from "@/lib/memo";
import { REFERRED_HEADING, referReasonPresentation, TWO_JUDGES_ONLY_LABEL } from "@/lib/referReason";
import { bindingLegText, nonReferReasonText, quoteCheckPresentation } from "@/lib/reasonText";
import { highlightQuote, leanAttestationView } from "@/lib/quoteHighlight";
import { standardLine } from "@/lib/standardLine";
import { classifyAnalyseError, fetchServiceStatus, formatNextOpen, isClosed, type StatusResult } from "@/lib/serviceStatus";
import { PageHeader } from "@/components/PageHeader";
import { StatuteNotice } from "@/components/StatuteNotice";
import { CaveatStrip } from "@/components/CaveatStrip";
import { StatuteBeside } from "@/components/StatuteBeside";
import { EXAMPLE_CONTRACTS, EXAMPLE_FACTS_TEXT, EXAMPLE_ID, EXAMPLE_LABEL } from "@/lib/demo/example";
import { validatedById, validationLabel, validationMark, type ValidationMark } from "@/lib/surfaceCopy";

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

// A normal cold start is about three minutes (the line above); past it the page says the models may be off, instead of counting on.
const SLOW_START_SECONDS = 200;

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

function ElementRow({ el, facts }: { el: AnalyseFactsContract["elements"][number]; facts: ReadonlyArray<{ id: string; text: string }> }) {
  // Label and tone come from lib/elementStatus.ts, not from a boolean here: the engine has four statuses and
  // an unrecognised one must not be shown as a definite negative (AxisMeru/pravrudhi#37).
  const status = elementStatusPresentation(el.status);
  // Why a quote was rejected (the engine's quote check), and which judge's threshold a non-established element failed.
  const quoteCheck = quoteCheckPresentation(el.quote_check);
  const leg = el.status === "established" ? null : bindingLegText(el.binding_leg);
  const view = highlightQuote(facts, el);
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
        {status.explanation && status.verdict === null && (
          <div className="mt-1 text-xs text-[var(--color-text-dim)]" data-testid="status-explanation">
            {status.explanation}
          </div>
        )}
      </td>
      <td className="py-2 align-top text-sm text-[var(--color-text-dim)]">
        {el.quote ? (
          <>
            {view.kind === "highlight" ? (
              // Valid highlight: show the quote once, inside its fact. The italic quote below is the fallback when the offsets cannot be used.
              <div className="text-xs not-italic" data-testid="quote-in-fact">
                <span className="text-[11px]">In fact {view.factId}: </span>
                {view.cutBefore && "…"}
                {view.before}
                <mark className="rounded-sm bg-amber-500/25 px-0.5 text-[var(--color-text)]">{view.quote}</mark>
                {view.after}
                {view.cutAfter && "…"}
              </div>
            ) : (
              <span className="italic">&ldquo;{el.quote}&rdquo;</span>
            )}
            {el.quote_source && <span className="ml-1.5 text-[11px]">— {el.quote_source}</span>}
          </>
        ) : el.error ? (
          <span className="text-red-400">{el.error}</span>
        ) : (
          <span>no quote</span>
        )}
        {quoteCheck?.show && (
          <div className="mt-1 text-xs text-[var(--color-text-dim)]" data-testid="quote-check-cause">
            {quoteCheck.text}
            {!quoteCheck.unknown && el.quote_check && <span className="ml-1 text-[11px]">({el.quote_check})</span>}
          </div>
        )}
        {leg && (
          <div className="mt-1 text-xs text-[var(--color-text-dim)]" data-testid="binding-leg">
            {leg}
          </div>
        )}
      </td>
    </tr>
  );
}

function ContractResult({ c, mark, facts }: { c: AnalyseFactsContract; mark?: ValidationMark; facts: ReadonlyArray<{ id: string; text: string }> }) {
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
        <div className="text-sm font-medium text-[var(--color-text)]">
          {c.contract_id}
          {mark && validationLabel(mark) && (
            <span className="ml-2 rounded border border-amber-500/40 px-1.5 py-0.5 text-[11px] font-normal text-amber-300" data-testid="not-validated-badge">
              {validationLabel(mark)}
            </span>
          )}
        </div>
        <OutcomeBadge outcome={c.outcome} />
      </header>

      {c.outcome === "REFER_TO_LAWYER" && (() => {
        // R1's finding (2026-09-27): every REFER_TO_LAWYER used to show this same "not confident" sentence,
        // even for reasons that are not uncertainty at all (second_judge_unavailable, contract_not_validated,
        // ...). referReasonPresentation names the actual situation; the raw reason code is always shown too,
        // never hidden or reinterpreted, so a reader (or a reviewer) can always see exactly what the engine
        // said even if this build's wording is wrong or stale.
        const referred = referReasonPresentation(c.reason);
        return (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
            <p className="font-medium" data-testid="referred-heading">{REFERRED_HEADING}</p>
            <p className="mt-1" data-testid="referred-sentence">{referred.message}</p>
            {referred.twoJudgesOnly && <p className="mt-1 text-[11px] text-amber-300/70" data-testid="referred-two-judges">{TWO_JUDGES_ONLY_LABEL}</p>}
            <p className="mt-1 text-xs text-amber-300/70">reason: {c.reason}</p>
          </div>
        );
      })()}

      {c.elements.length > 0 && (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-xs text-[var(--color-text-dim)]">
              <th className="pb-1 pr-3 font-medium">element</th>
              <th className="pb-1 pr-3 font-medium">status</th>
              <th className="pb-1 font-medium">quote (verbatim from your facts)</th>
            </tr>
          </thead>
          <tbody>
            {c.elements.map((el, i) => (
              <ElementRow key={`${el.element}-${i}`} el={el} facts={facts} />
            ))}
          </tbody>
        </table>
      )}

      <StatuteBeside citations={c.citations} />

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
          {(() => {
            const att = leanAttestationView(c.lean_attestation);
            return att && (
              <div className="mt-2 border-t border-[var(--color-border)] pt-2 text-[var(--color-text-dim)]" data-testid="lean-attestation">
                <div>{att.note}</div>
                {att.rows.map((r) => (
                  <div key={r.label} className="mt-1 break-all">
                    {r.label}: <code title={r.full} className="text-[11px]">{r.full}</code>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {!isUncovered(c) && c.outcome !== "REFER_TO_LAWYER" && c.reason && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="reason-text">
          {nonReferReasonText(c.reason) ?? "The engine gave a reason this app does not recognise yet."}{" "}
          <span className="text-[11px]">(reason: {c.reason})</span>
        </p>
      )}
    </article>
  );
}

// Built in the browser from the result already on screen; nothing is sent anywhere.
function downloadMemo(result: AnalyseFactsResult, engineVersion: string | null): void {
  const md = buildMemo(result, { engineVersion, generatedAt: new Date().toISOString() });
  const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `analysis-memo-${result.run_id}.md`;
  a.click();
  URL.revokeObjectURL(url);
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
  // null until the registry read succeeds; stays null if it fails, which the page shows as "validation status unavailable".
  const [exampleActive, setExampleActive] = useState(false);
  const [validated, setValidated] = useState<Map<string, boolean> | null>(null);
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

  // /matters?example=<id> loads the demo example (the allegations of one public judgment). Applied from a microtask, not
  // synchronously in the effect (the page is statically exported, so the query string is only known in the browser).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("example") !== EXAMPLE_ID) return;
    void Promise.resolve().then(() => {
      setFactsText(EXAMPLE_FACTS_TEXT);
      setExampleActive(true);
    });
  }, []);

  useEffect(() => {
    let off = false;
    nyayaRegistryEntries()
      .then((entries) => !off && setValidated(validatedById(entries)))
      .catch(() => !off && setValidated(null)); // a failed read is SHOWN as "validation status unavailable, verify"
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    let off = false;
    nyayaRegistryContracts()
      .then((cs) => {
        if (off) return;
        setContracts(cs);
        if (new URLSearchParams(window.location.search).get("example") === EXAMPLE_ID) {
          setSelected(new Set(EXAMPLE_CONTRACTS.filter((id) => cs.includes(id))));
        }
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
    const check = checkFacts(factsText);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    const facts = check.facts;
    if (selected.size === 0) {
      setError("Select at least one contract.");
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
      <PageHeader title="Matters" subtitle="Element-by-element reading of a matter's facts: each established element is tied to a verbatim quote from your facts, and anything uncertain is referred to a lawyer." />
      <div className="flex flex-1 flex-col gap-6 p-8">
        {exampleActive && (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)]" data-testid="example-banner">
            {EXAMPLE_LABEL}
          </p>
        )}
        <CaveatStrip retentionNotice={result?.retention_notice} warming={svc?.kind === "ok" && svc.status.judge.state === "warming"} />
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="matters-facts">
            Facts (one per line)
          </label>
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
                  setError(UNREADABLE_MESSAGE);
                  return;
                }
              }
              const r = await extractText(file, parsers);
              if (r.ok) {
                setFactsText(r.text);
                setError(null);
              } else setError(r.message);
            }}
          />
          <p className="text-xs text-[var(--color-text-dim)]">
            Files are read in your browser and never uploaded. Review and edit the text before analysing.
          </p>
          <textarea
            id="matters-facts"
            className="min-h-[120px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]"
            placeholder={"TOY: Kiran was engaged to Lata and told her he would marry her in the spring.\nTOY: Kiran had already decided never to marry Lata when he made that promise."}
            value={factsText}
            onChange={(e) => {
              setFactsText(e.target.value);
              setExampleActive(false); // an edited text is no longer the example
            }}
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
                    {validationLabel(validationMark(validated, id)) && (
                      <span className="text-amber-300">({validationLabel(validationMark(validated, id))})</span>
                    )}
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
              Warming up the judge and Lean checker — a first run after idle can take about 3 minutes.{" "}
              <span className="font-mono">
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}
              </span>{" "}
              elapsed.
            </p>
          )}
          {loading && elapsedSeconds >= SLOW_START_SECONDS && (
            <p className="text-sm text-amber-400" role="status" data-testid="matters-slow-start">
              This is taking longer than a normal start. The analysis models may be switched off at the moment. You can cancel
              and try again later; no result is returned until they answer.
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
            {(() => {
              // The standard of proof applied, next to the verdict (#32): from the engine's `standard` field, else its default.
              const std = standardLine(result.standard);
              return (
                <div className="text-xs text-[var(--color-text-dim)]" data-testid="standard-line">
                  <div>{std.text}</div>
                  {std.notice && <div data-testid="standard-notice">{std.notice}</div>}
                </div>
              );
            })()}
            <div className="flex gap-2 print:hidden" data-testid="memo-actions">
              <button
                type="button"
                className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                onClick={() => downloadMemo(result, svc?.kind === "ok" ? svc.status.engine_version : null)}
              >
                Download memo (.md)
              </button>
              <button
                type="button"
                className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                onClick={() => window.print()}
              >
                Print / save as PDF
              </button>
            </div>
            {result.contracts.map((c) => (
              <ContractResult key={c.contract_id} c={c} mark={validationMark(validated, c.contract_id)} facts={result.facts} />
            ))}
            <StatuteNotice />
          </div>
        )}
      </div>
    </div>
  );
}
