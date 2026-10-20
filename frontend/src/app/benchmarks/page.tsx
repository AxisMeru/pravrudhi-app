import { NyayaSiddhiComing } from "@/components/benchmarks/NyayaSiddhiComing";
import { NyayaSiddhiLink } from "@/components/benchmarks/NyayaSiddhiCard";
import { NyayaSiddhiResults } from "@/components/benchmarks/NyayaSiddhiResults";
import { NarratedDefaultFilm } from "@/components/films/NarratedDefaultFilm";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import rowsFile from "@/data/nyayasiddhi/rows.json";
import { BENCHMARKS_FILM_HEADING } from "@/lib/films/copy";
import { NS_SUBMIT_LINK_TEXT } from "@/lib/nyayasiddhiSubmit";
import { loadNyayasiddhiManifest } from "@/lib/films/nyayasiddhiFilms";
import { parseRows } from "@/lib/nyayasiddhiRows";
import { parseRowLinks } from "@/lib/nyayasiddhiRowLinks";
import rowLinksFile from "@/data/nyayasiddhi/row_links.json";
import { BENCHMARK_STATEMENTS, FOOTER_TEXT, HOW_WE_TEST, HOW_WE_TEST_HEADING, PAGE_SUBTITLE, PAGE_TITLE } from "@/lib/benchmarks";

const NYAYASIDDHI_LINKS = parseRowLinks(rowLinksFile);
const NYAYASIDDHI_ROWS = parseRows(rowsFile); // signed rows only, from the build-time data file; empty until the signed rows are supplied

// A short, static page in R1's words (lib/benchmarks.ts): what we check, how we test, and what the checks do and do not show. No figure.
export default async function BenchmarksPage() {
  // the explainer film #430 (Studio's final render; the manifests are loaded by a dynamic import, on this page only): the narrated cut is the default, the silent cut the fallback; poster first: no film file is requested until the visitor presses Play
  const narratedManifest = await loadNyayasiddhiManifest("nyayasiddhi-explainer");
  const silentManifest = await loadNyayasiddhiManifest("nyayasiddhi-explainer-silent");
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
          <Link href="/benchmarks/submit" className="inline-flex min-h-6 items-center text-sm text-[var(--color-accent)] underline max-md:min-h-11" data-testid="ns-submit-link">{NS_SUBMIT_LINK_TEXT}</Link>
        </section>
        <section className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-labelledby="benchmarks-film-heading" data-testid="block-film">
          <h2 id="benchmarks-film-heading" className="text-base font-medium text-[var(--color-text)]">{BENCHMARKS_FILM_HEADING}</h2>
          <NarratedDefaultFilm narrated={narratedManifest} silent={silentManifest} />
        </section>
        <NyayaSiddhiResults rows={NYAYASIDDHI_ROWS} links={NYAYASIDDHI_LINKS} />
        <NyayaSiddhiComing rows={NYAYASIDDHI_ROWS} />
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
