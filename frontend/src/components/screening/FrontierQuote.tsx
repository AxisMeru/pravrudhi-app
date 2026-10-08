import { FRONTIER_ADVISORY_TEXT, frontierCell, quoteCheckLabel, type FrontierReading } from "@/lib/frontierReader";

/** A frontier reader's quote and how the engine's check came out. The only place on the Screening page that says "quote". */
export function FrontierQuote({ quote, check }: { quote: string; check: string | null | undefined }) {
  const passed = (check ?? "").trim() === "ok";
  return (
    <div className="text-xs" data-testid="frontier-quote">
      <span className="italic">&ldquo;{quote}&rdquo;</span>
      <span className={`ml-1.5 ${passed ? "text-[var(--color-text-dim)]" : "text-amber-300"}`} data-testid="frontier-quote-check" data-passed={passed}>
        {quoteCheckLabel(check)}
      </span>
    </div>
  );
}

/** The "Frontier reader" cell of a checklist row: its claim, its quote with the check, and the advisory line. Nothing here is a status. */
export function FrontierCell({ reading }: { reading: FrontierReading | null | undefined }) {
  const cell = frontierCell(reading);
  if (!cell) return null;
  return (
    <div className="space-y-1" data-testid="frontier-cell">
      <p className="text-xs text-[var(--color-text)]">{cell.claim}</p>
      {cell.quote !== null && <FrontierQuote quote={cell.quote} check={reading?.quote_check} />}
      <p className="text-[11px] text-[var(--color-text-dim)]">{FRONTIER_ADVISORY_TEXT}</p>
    </div>
  );
}
