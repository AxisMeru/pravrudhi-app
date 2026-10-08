import Link from "next/link";
import { NyayaSiddhiLink } from "@/components/benchmarks/NyayaSiddhiCard";
import { PageHeader } from "@/components/PageHeader";
import { CaveatStrip } from "@/components/CaveatStrip";
import { EXAMPLE_ID, EXAMPLE_LABEL } from "@/lib/demo/example";
import { ASSIST_LINE } from "@/lib/demo/safety";
import { STEPS } from "@/lib/demo/steps";

// How the analysis works, as five steps on one public judgment's allegations. The steps describe what the Matters page
// does when it runs; the page itself shows no result and quotes no measure from the example (the example is illustrative,
// not evidence). Words: Lead-2's decision on #525 (2026-10-06); R1 reviews them.

export default function DemoPage() {
  return (
    <div>
      <PageHeader title="How it works" subtitle="Five steps, on one public judgment's allegations." />
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
            href={`/screening?example=${EXAMPLE_ID}`}
            className="inline-flex w-fit items-center rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white"
            data-testid="load-example"
          >
            Open Screening with the example loaded
          </Link>
          <Link href="/safety" className="text-sm underline">
            Safety record
          </Link>
        </div>
        <NyayaSiddhiLink />
        <CaveatStrip />
        <p className="text-sm text-[var(--color-text)]">{ASSIST_LINE}</p>
      </div>
    </div>
  );
}
