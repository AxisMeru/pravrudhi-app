import { ALTERNATE_LIMB_NOTE, CHIP_LABEL, ipcDisclosure, DEFENCE_HEADING, NO_CHECK_NOTE, NO_FACT_GROUP_HEADING, WHAT_TO_CHECK_LABEL, REASON_CODE_LABEL, CONTRACT_REVIEW_HEADING, DEFENCE_PROMPT_NOTE } from "@/lib/screening/copy";
import { contractReferral, rowsFor, summarize, type ScreeningRow } from "@/lib/screening/model";
import { blockTitle, isAlternateLimb, offenceOf } from "@/lib/screening/offences";
import type { AnalyseFactsContract, AnalyseFactsResult } from "@/lib/api";
import { CHIP_TONE, SummaryBanner } from "./SummaryBanner";

function Row({ row }: { row: ScreeningRow }) {
  return (
    <li className="space-y-2 rounded-md border border-[var(--color-border)] p-3" data-testid="ingredient-row" data-chip={row.chip}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-base font-medium leading-6 text-[var(--color-text)]" data-testid="ingredient-text">{row.element}</p>
        <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-normal ${CHIP_TONE[row.chip]}`} data-testid="ingredient-chip">
          {CHIP_LABEL[row.chip]}
        </span>
      </div>
      {row.reason && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="ingredient-reason">
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
      <p className="border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-dim)]" data-testid="what-to-check">
        <span className="font-medium text-[var(--color-text-dim)]">{WHAT_TO_CHECK_LABEL}: </span>
        {row.whatToCheck ?? NO_CHECK_NOTE}
      </p>
    </li>
  );
}

export function IngredientChecklist({ contract, facts, agenda = false }: { contract: AnalyseFactsContract; facts: AnalyseFactsResult["facts"]; agenda?: boolean }) {
  const rows = rowsFor(contract, facts);
  const summary = summarize(contract, rows);
  const referral = contractReferral(contract);
  const offence = offenceOf(contract.contract_id);
  return (
    <section className="space-y-3" data-testid="checklist" aria-label={`Ingredients: ${blockTitle(contract.contract_id)}`}>
      <header>
        <h2 className="text-base font-semibold text-[var(--color-text)]">{blockTitle(contract.contract_id)}</h2>
        <p className="text-xs text-[var(--color-text-dim)]">
          {offence?.sections ?? ""}
        </p>
        {isAlternateLimb(contract.contract_id) && <p className="text-xs text-[var(--color-text-dim)]" data-testid="alternate-limb-note">{ALTERNATE_LIMB_NOTE}</p>}
        {offence?.ipcChecked && (
          <p className="text-xs text-[var(--color-text-dim)]" data-testid="ipc-disclosure">{ipcDisclosure(offence.ipcChecked)}</p>
        )}
      </header>
      <SummaryBanner summary={summary} agenda={agenda} />
      {referral && (
        <div className="rounded-md border border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] p-3 text-sm text-[var(--color-warn)]" data-testid="contract-review">
          <p className="font-medium">{CONTRACT_REVIEW_HEADING}</p>
          <p className="mt-1">{referral.message}</p>
          {referral.unknown && <p className="mt-1 text-xs text-[var(--color-warn)]" data-testid="contract-review-code">{REASON_CODE_LABEL}: {referral.code}</p>}
        </div>
      )}
      <ul className="space-y-2" aria-label="Ingredients">
        {rows.ingredients.filter((r) => r.chip !== "not_supported").map((r, i) => (
          <Row key={`${r.element}-${i}`} row={r} />
        ))}
      </ul>
      {rows.ingredients.some((r) => r.chip === "not_supported") && (
        <div className="space-y-2" data-testid="no-fact-group">
          <h3 className="text-sm font-medium text-[var(--color-text)]">{NO_FACT_GROUP_HEADING}</h3>
          <ul className="space-y-2" aria-label={NO_FACT_GROUP_HEADING}>
            {rows.ingredients.filter((r) => r.chip === "not_supported").map((r, i) => (
              <Row key={`${r.element}-${i}`} row={r} />
            ))}
          </ul>
        </div>
      )}
      {rows.defences.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--color-text)]">{DEFENCE_HEADING}</h3>
          <p className="text-xs text-[var(--color-text-dim)]" data-testid="defence-prompt-note">{DEFENCE_PROMPT_NOTE}</p>
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
