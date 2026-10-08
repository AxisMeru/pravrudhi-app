import { CHIP_LABEL, ipcDisclosure, DEFENCE_HEADING, NO_CHECK_NOTE, WHAT_TO_CHECK_LABEL, SEE_REASON, CONTRACT_REVIEW_HEADING } from "@/lib/screening/copy";
import { contractReferral, rowsFor, summarize, type ScreeningRow } from "@/lib/screening/model";
import { offenceOf } from "@/lib/screening/offences";
import type { AnalyseFactsContract, AnalyseFactsResult } from "@/lib/api";
import { CHIP_TONE, SummaryBanner } from "./SummaryBanner";

function Row({ row }: { row: ScreeningRow }) {
  return (
    <li className="space-y-2 rounded-md border border-[var(--color-border)] p-3" data-testid="ingredient-row" data-chip={row.chip}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-[var(--color-text)]" data-testid="ingredient-text">{row.element}</p>
        <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${CHIP_TONE[row.chip]}`} data-testid="ingredient-chip">
          {CHIP_LABEL[row.chip]}
        </span>
      </div>
      {row.reason && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="ingredient-reason">
          <span className="sr-only">{SEE_REASON}: </span>
          {row.reason}
        </p>
      )}
      {row.note && (
        <div className="space-y-1" data-testid="cited-fact">
          <p className="text-xs text-[var(--color-text-dim)]" data-testid="cited-fact-note">{row.note}</p>
          {row.factText && (
            <blockquote className="whitespace-pre-wrap rounded border-l-2 border-[var(--color-border)] pl-3 text-sm text-[var(--color-text)]" data-testid="cited-fact-text">
              <span className="mr-1 font-mono text-xs text-[var(--color-text-dim)]">{row.factId}</span>
              {row.factText}
            </blockquote>
          )}
        </div>
      )}
      {row.quote && (
        <p className="text-sm italic text-[var(--color-text)]" data-testid="model-quote">
          &ldquo;{row.quote.text}&rdquo;
          {row.quote.check && <span className="ml-1.5 text-[11px] not-italic text-[var(--color-text-dim)]">{row.quote.check}</span>}
        </p>
      )}
      <p className="text-xs text-[var(--color-text-dim)]" data-testid="what-to-check">
        <span className="font-medium text-[var(--color-text)]">{WHAT_TO_CHECK_LABEL}: </span>
        {row.whatToCheck ?? NO_CHECK_NOTE}
      </p>
    </li>
  );
}

export function IngredientChecklist({ contract, facts }: { contract: AnalyseFactsContract; facts: AnalyseFactsResult["facts"] }) {
  const rows = rowsFor(contract, facts);
  const summary = summarize(contract, rows);
  const referral = contractReferral(contract);
  const offence = offenceOf(contract.contract_id);
  return (
    <section className="space-y-3" data-testid="checklist" aria-label={`Ingredients: ${offence?.title ?? contract.contract_id}`}>
      <header>
        <h2 className="text-base font-semibold text-[var(--color-text)]">{offence?.title ?? contract.contract_id}</h2>
        <p className="text-xs text-[var(--color-text-dim)]">
          {offence?.sections ? `${offence.sections} · ` : ""}
          <span className="font-mono">{contract.contract_id}</span>
        </p>
        {offence?.ipcChecked && (
          <p className="text-xs text-[var(--color-text-dim)]" data-testid="ipc-disclosure">{ipcDisclosure(offence.ipcChecked)}</p>
        )}
      </header>
      <SummaryBanner summary={summary} />
      {referral && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300" data-testid="contract-review">
          <p className="font-medium">{CONTRACT_REVIEW_HEADING}</p>
          <p className="mt-1">{referral.message}</p>
          <p className="mt-1 text-xs text-amber-300/70">{SEE_REASON}: {referral.code}</p>
        </div>
      )}
      <ul className="space-y-2" aria-label="Ingredients">
        {rows.ingredients.map((r, i) => (
          <Row key={`${r.element}-${i}`} row={r} />
        ))}
      </ul>
      {rows.defences.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--color-text)]">{DEFENCE_HEADING}</h3>
          <ul className="space-y-2">
            {rows.defences.map((r, i) => (
              <Row key={`${r.element}-${i}`} row={r} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
