import { PageHeader } from "@/components/PageHeader";
import { ASSIST_LINE, SAFETY_FIGURES, SAFETY_LABEL, SAFETY_MATERIAL, SAFETY_RECORDS, SAFETY_STACK } from "@/lib/demo/safety";

// What was measured, on what, and what it does not cover. Every figure comes from lib/demo/safety.ts, which names the
// record each rests on. No figure is shown anywhere else in the interface, and none comes from the demo example.
export default function SafetyPage() {
  return (
    <div>
      <PageHeader title="Safety record" subtitle="What was measured, on what material, and what it does not cover." />
      <div className="space-y-6 p-8">
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)]" data-testid="safety-label">
          {SAFETY_LABEL}
        </p>
        <div className="grid gap-4 md:grid-cols-2" data-testid="safety-figures">
          {SAFETY_FIGURES.map((f) => (
            <section key={f.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="text-sm font-medium text-[var(--color-text)]">{f.heading}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-dim)]">{f.text}</p>
            </section>
          ))}
        </div>
        <section>
          <h2 className="text-sm font-medium text-[var(--color-text)]">Material</h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">{SAFETY_MATERIAL}</p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-[var(--color-text)]">Stack</h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">{SAFETY_STACK}</p>
        </section>
        <section>
          <h2 className="text-sm font-medium text-[var(--color-text)]">Where these figures come from</h2>
          <p className="mt-1 text-xs text-[var(--color-text-dim)]">Internal records of a private repository: not public, available from the team on request.</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[var(--color-text-dim)]">
            {SAFETY_RECORDS.map((r) => (
              <li key={r.figure}>
                {r.figure}: {r.repo} @ {r.commit.slice(0, 12)}, {r.path}
              </li>
            ))}
          </ul>
        </section>
        <p className="text-sm font-medium text-[var(--color-text)]">{ASSIST_LINE}</p>
      </div>
    </div>
  );
}
