import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { CaveatStrip } from "@/components/CaveatStrip";
import { EXAMPLE_ID, EXAMPLE_LABEL } from "@/lib/demo/example";
import { ASSIST_LINE } from "@/lib/demo/safety";

// How the analysis works, as five steps on one public judgment's allegations. The steps describe what the Matters page
// does when it runs; the page itself shows no result and quotes no measure from the example (the example is illustrative,
// not evidence). Words: Lead-2's decision on #525 (2026-10-06); R1 reviews them.
const STEPS: { title: string; body: string }[] = [
  {
    title: "Paste the facts and name the provision",
    body:
      "The example loads the allegations recited in a public High Court order, with the two IPC provisions it invokes selected. " +
      "The statute text appears beside the analysis, with the notice that it is an unofficial copy.",
  },
  {
    title: "Read the elements as a checklist",
    body: "Each contract lists the elements the provision requires, so you can see what would have to be shown.",
  },
  {
    title: "See the cited fact and the status of each element",
    body:
      "For every element the analysis quotes the sentence of your facts it relies on, word for word, and gives its status. " +
      "If an element cannot be decided it says so, with the reason the engine gives; nothing is filled in to look complete.",
  },
  {
    title: "Read the referral summary",
    body:
      "Anything uncertain is referred to a lawyer instead of guessed. A contract the registry does not list as validated " +
      "carries the mark \"not validated, verify\".",
  },
  {
    title: "Read the safety record",
    body: "What was measured, on what material and with which models, set beside what it did not cover.",
  },
];

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
            href={`/matters?example=${EXAMPLE_ID}`}
            className="inline-flex w-fit items-center rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white"
            data-testid="load-example"
          >
            Open Matters with the example loaded
          </Link>
          <Link href="/safety" className="text-sm underline">
            Safety record
          </Link>
        </div>
        <CaveatStrip />
        <p className="text-sm text-[var(--color-text)]">{ASSIST_LINE}</p>
      </div>
    </div>
  );
}
