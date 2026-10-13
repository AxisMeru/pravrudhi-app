import { PageHeader } from "@/components/PageHeader";
import { ASSIST_LINE, EVIDENCE_LINE, SAFETY_STATEMENTS, SAFETY_SUBTITLE } from "@/lib/demo/safety";

// What the screen does and does not do, in R1's words (lib/demo/safety.ts). No figure is shown anywhere in the interface.
export default function SafetyPage() {
  return (
    <div>
      <PageHeader title="Safety record" subtitle={SAFETY_SUBTITLE} />
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <ul className="space-y-3" data-testid="safety-statements">
          {SAFETY_STATEMENTS.map((s) => (
            <li key={s} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text)]">
              {s}
            </li>
          ))}
        </ul>
        <p className="text-sm font-medium text-[var(--color-text)]">{ASSIST_LINE}</p>
        <p className="text-sm text-[var(--color-text-dim)]">{EVIDENCE_LINE}</p>
      </div>
    </div>
  );
}
