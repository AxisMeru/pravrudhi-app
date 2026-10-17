import { NS_COMING, comingLines } from "@/lib/nyayasiddhiComing";
import type { ResultRow } from "@/lib/nyayasiddhiRows";

/** What this page does not hold yet, in R1's words (app#429 PR-A): each line is shown only when it is true of the rows the page has. */
export function NyayaSiddhiComing({ rows }: { rows: readonly ResultRow[] }) {
  return (
    <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-labelledby="ns-coming-heading" data-testid="ns-coming">
      <h2 id="ns-coming-heading" className="text-base font-medium text-[var(--color-text)]">{NS_COMING.coming_heading}</h2>
      <ul className="space-y-2 text-sm text-[var(--color-text)]">
        {comingLines(rows).map((l) => <li key={l}>{l}</li>)}
      </ul>
    </section>
  );
}
