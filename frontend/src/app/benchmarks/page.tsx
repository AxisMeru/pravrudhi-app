import { NyayaSiddhiLink } from "@/components/benchmarks/NyayaSiddhiCard";
import { NyayaSiddhiResults } from "@/components/benchmarks/NyayaSiddhiResults";
import { PageHeader } from "@/components/PageHeader";
import rowsFile from "@/data/nyayasiddhi/rows.json";
import { parseRows } from "@/lib/nyayasiddhiRows";
import { BENCHMARK_STATEMENTS, FOOTER_TEXT, HOW_WE_TEST, HOW_WE_TEST_HEADING, PAGE_SUBTITLE, PAGE_TITLE } from "@/lib/benchmarks";

const NYAYASIDDHI_ROWS = parseRows(rowsFile); // signed rows only, from the build-time data file; empty until the signed rows are supplied

// A short, static page in R1's words (lib/benchmarks.ts): what we check, how we test, and what the checks do and do not show. No figure.
export default function BenchmarksPage() {
  return (
    <div>
      <PageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
        <ul className="space-y-3" data-testid="benchmark-statements">
          {BENCHMARK_STATEMENTS.map((s) => (
            <li key={s} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text)]">
              {s}
            </li>
          ))}
        </ul>
        <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid="block-nyayasiddhi">
          <h2 className="text-base font-medium text-[var(--color-text)]">NyayaSiddhi</h2>
          <NyayaSiddhiLink />
        </section>
        <NyayaSiddhiResults rows={NYAYASIDDHI_ROWS} />
        <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid="block-how">
          <h2 className="text-base font-medium text-[var(--color-text)]">{HOW_WE_TEST_HEADING}</h2>
          <p className="text-sm text-[var(--color-text)]">{HOW_WE_TEST}</p>
        </section>
        <footer className="text-sm font-medium text-[var(--color-text)]" data-testid="benchmarks-footer">
          {FOOTER_TEXT}
        </footer>
      </div>
    </div>
  );
}
