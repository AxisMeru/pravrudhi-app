import Link from "next/link";
import { DEMO_FILM_LINK, GUIDE_FILM_LINK } from "@/lib/films/copy";
import { NyayaSiddhiLink } from "@/components/benchmarks/NyayaSiddhiCard";
import { PageHeader } from "@/components/PageHeader";
import { CaveatStrip } from "@/components/CaveatStrip";
import { DEFAULT_EXAMPLE, EXAMPLES, EXAMPLE_LABEL } from "@/lib/demo/example";
import { ASSIST_LINE } from "@/lib/demo/safety";
import { STEPS } from "@/lib/demo/steps";

// How the analysis works, as five steps on a public court order's allegations. The steps describe what the Matters page
// does when it runs; the page itself shows no result and quotes no measure from the example (the example is illustrative,
// not evidence). Words: Lead-2's decision on #525 (2026-10-06); R1 reviews them.

export default function DemoPage() {
  return (
    <div>
      <PageHeader title="How it works" subtitle="Five steps, on a public court order." />
      <div className="space-y-6 p-8">
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="example-label">
          {EXAMPLE_LABEL}
        </p>
        <ol className="space-y-4" data-testid="demo-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="text-sm font-medium text-[var(--color-text)]">
                {i + 1}. {s.title}
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-dim)]">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/screening?example=${DEFAULT_EXAMPLE.id}`}
            className="inline-flex w-fit items-center rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-accent)]"
            data-testid="load-example"
          >
            Open Screening with the example loaded
          </Link>
          <Link href="/safety" className="inline-flex min-h-6 items-center text-sm underline">
            Safety record
          </Link>
          <Link href="/technical-film" className="inline-flex min-h-6 items-center text-sm underline" data-testid="demo-technical-film">{DEMO_FILM_LINK}</Link>
          <Link href="/guide#film" className="inline-flex min-h-6 items-center text-sm underline" data-testid="demo-guide-film">{GUIDE_FILM_LINK}</Link>
        </div>
        {EXAMPLES.length > 1 && (
          <section aria-label="Examples" className="space-y-2" data-testid="example-list">
            <h2 className="text-sm font-medium text-[var(--color-text)]">More examples</h2>
            <ul className="space-y-1 text-sm">
              {EXAMPLES.slice(1).map((e) => (
                <li key={e.id}>
                  <Link href={`/screening?example=${e.id}`} className="inline-flex min-h-6 items-center underline" data-testid={`load-example-${e.id}`}>{e.citation}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <NyayaSiddhiLink />
        <CaveatStrip />
        <p className="text-sm text-[var(--color-text)]">{ASSIST_LINE}</p>
      </div>
    </div>
  );
}
