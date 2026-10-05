import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import type { AnalyseFactsContract, AnalyseFactsElement } from "@/lib/api";
import { elementStatusPresentation } from "@/lib/elementStatus";
import { citationLabel, citationState, isUncovered, quoteSegments, shortSha } from "@/lib/matterResults";
import { referReasonPresentation } from "@/lib/referReason";

type Fact = { id: string; text: string };

const OUTCOME: Record<string, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  PROOF: { label: "established", tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10", Icon: CheckCircle2 },
  DENIAL: { label: "not established", tone: "text-red-400 border-red-500/40 bg-red-500/10", Icon: XCircle },
  ABSTAIN: { label: "abstained", tone: "text-sky-400 border-sky-500/40 bg-sky-500/10", Icon: HelpCircle },
  REFER_TO_LAWYER: { label: "refer to a lawyer", tone: "text-amber-400 border-amber-500/40 bg-amber-500/10", Icon: AlertTriangle },
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const o = OUTCOME[outcome] ?? { label: outcome, tone: "text-[var(--color-text-dim)] border-[var(--color-border)]", Icon: HelpCircle };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${o.tone}`}>
      <o.Icon size={13} aria-hidden="true" /> {o.label}
    </span>
  );
}

function QuoteCell({ el, facts }: { el: AnalyseFactsElement; facts: readonly Fact[] }) {
  if (el.error) return <span className="text-red-400">{el.error}</span>;
  if (!el.quote) {
    return (
      <span data-testid="no-supporting-quote" className="text-[var(--color-text-dim)]">
        no supporting quote
      </span>
    );
  }
  const seg = quoteSegments(el, facts);
  return (
    <>
      {seg ? (
        <span data-testid="quote-highlight">
          {seg.before}
          <mark className="rounded bg-amber-400/25 px-0.5 text-[var(--color-text)]">{seg.mark}</mark>
          {seg.after}
        </span>
      ) : (
        <span className="italic">&ldquo;{el.quote}&rdquo;</span>
      )}
      <span className="ml-1.5 text-[11px]">
        {el.fact_id ? `${el.fact_id}` : ""}
        {el.quote_source ? ` · ${el.quote_source}` : ""}
      </span>
    </>
  );
}

function ElementRow({ el, facts }: { el: AnalyseFactsElement; facts: readonly Fact[] }) {
  const status = elementStatusPresentation(el.status);
  return (
    <tr className="border-t border-[var(--color-border)] align-top">
      <th scope="row" className="py-2 pr-3 text-left text-sm font-normal text-[var(--color-text)]">
        {el.element}
      </th>
      <td className="py-2 pr-3">
        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${status.tone}`}>{status.label}</span>
        {el.p_established !== null && <span className="ml-1.5 text-[11px] text-[var(--color-text-dim)]">p={el.p_established.toFixed(2)}</span>}
      </td>
      <td className="py-2 text-sm text-[var(--color-text-dim)]">
        <QuoteCell el={el} facts={facts} />
      </td>
    </tr>
  );
}

function ReferLine({ reason }: { reason: string }) {
  const referred = referReasonPresentation(reason);
  return (
    <div data-testid="refer-line" className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
      <p>This matter should be reviewed by a lawyer — {referred.message}.</p>
      <p className="mt-1 text-xs text-amber-300/70">reason: {reason}</p>
    </div>
  );
}

export function ContractResult({
  c,
  facts,
  coverage,
}: {
  c: AnalyseFactsContract;
  facts: readonly Fact[];
  coverage: Map<string, boolean> | null;
}) {
  if (isUncovered(c.contract_id, coverage)) {
    return (
      <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--color-text)]">{c.contract_id}</h3>
          <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-dim)]">not yet covered</span>
        </header>
        <p className="mt-2 text-sm text-[var(--color-text-dim)]">
          No judge has been validated for this contract yet — this is a gap in coverage, not a failed or wrong answer. Ask about a
          different matter, or check back once this contract is validated.
        </p>
        {c.outcome === "REFER_TO_LAWYER" && <ReferLine reason={c.reason} />}
      </article>
    );
  }

  const validated = coverage?.get(c.contract_id) === true;
  const citations = c.citations ?? null;
  const att = c.lean_attestation ?? null;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--color-text)]">
          {c.contract_id}
          {validated && (
            <span data-testid="validated-badge" className="ml-2 rounded-md border border-emerald-500/40 px-1.5 py-0.5 text-[11px] font-normal text-emerald-400">
              judge validated on constructed, in-distribution sets
            </span>
          )}
        </h3>
        <OutcomeBadge outcome={c.outcome} />
      </header>

      {c.outcome === "REFER_TO_LAWYER" && <ReferLine reason={c.reason} />}

      {c.elements.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left">
            <caption className="sr-only">Elements of {c.contract_id}</caption>
            <thead>
              <tr className="text-xs text-[var(--color-text-dim)]">
                <th scope="col" className="pb-1 pr-3 font-medium">element</th>
                <th scope="col" className="pb-1 pr-3 font-medium">status</th>
                <th scope="col" className="pb-1 font-medium">supporting quote (highlighted in your fact)</th>
              </tr>
            </thead>
            <tbody>
              {c.elements.map((el, i) => (
                <ElementRow key={`${el.element}-${i}`} el={el} facts={facts} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {c.lean && (
        <section aria-label="Lean structural check" className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs">
          <div className="font-medium text-[var(--color-text)]">Lean structural check: {c.lean_outcome ?? c.lean.verdict}</div>
          <div className="mt-1 text-[var(--color-text-dim)]">
            Lean checks that the right elements for this contract were addressed — it does not read the facts or quotes. The element findings
            above come from the judge and are quote-checked against the facts you supplied.
          </div>
          {c.lean.denied_claims.length > 0 && <div className="mt-1 text-[var(--color-text-dim)]">denied: {c.lean.denied_claims.join(", ")}</div>}
          {c.lean.unlicensed_claims.length > 0 && <div className="mt-1 text-[var(--color-text-dim)]">unlicensed: {c.lean.unlicensed_claims.join(", ")}</div>}
          {c.lean.omitted_claims.length > 0 && <div className="mt-1 text-[var(--color-text-dim)]">omitted: {c.lean.omitted_claims.join(", ")}</div>}
          {att && (
            <dl data-testid="lean-attestation" className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[var(--color-text-dim)]">
              <dt>checker binary</dt>
              <dd className="break-all font-mono">{shortSha(att.binary_sha256)}</dd>
              <dt>input handed to Lean</dt>
              <dd className="break-all font-mono">{shortSha(att.wire_sha256)}</dd>
              <dt>checker verdict</dt>
              <dd>{att.verdict}</dd>
            </dl>
          )}
        </section>
      )}

      {citations && (
        <section aria-label="Statute citations" data-testid="citations" className="text-xs">
          <div className="font-medium text-[var(--color-text)]">Statute references</div>
          {citations.length === 0 ? (
            <p className="mt-1 text-[var(--color-text-dim)]">none listed for this contract</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1">
              {citations.map((ct, i) =>
                citationState(ct) === "in_corpus" ? (
                  <li key={i} className="text-[var(--color-text-dim)]">
                    {citationLabel(ct)}
                    {ct.title ? ` — ${ct.title}` : ""} <span className="text-emerald-400">found in corpus</span>
                  </li>
                ) : (
                  <li key={i} data-testid="citation-unresolved" className="text-amber-300">
                    {citationLabel(ct)} <span className="rounded-md border border-amber-500/40 px-1 py-0.5">not found in corpus</span>
                  </li>
                ),
              )}
            </ul>
          )}
        </section>
      )}

      {c.reason && <p className="text-xs text-[var(--color-text-dim)]">{c.reason}</p>}
    </article>
  );
}
