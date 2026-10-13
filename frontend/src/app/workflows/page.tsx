import { PageHeader } from "@/components/PageHeader";
import { WORKFLOWS, WORKFLOWS_CLOSING, WORKFLOWS_TITLE } from "@/lib/workflowsCopy";

// A static, honest list: no start button, no progress, no figures. Words in lib/workflowsCopy.ts (R1's exact text).
export default function WorkflowsPage() {
  return (
    <div>
      <PageHeader title={WORKFLOWS_TITLE} />
      <div className="mx-auto max-w-3xl space-y-4 p-8" data-testid="workflows">
        <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
          {WORKFLOWS.map((w) => (
            <li key={w.name} className="flex flex-wrap items-baseline justify-between gap-2 p-3" data-testid="workflow-row">
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{w.name}</div>
                {w.note && <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">{w.note}</div>}
              </div>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${w.status === "Building" ? "border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] text-[var(--color-warn)]" : "border-[var(--color-control-border)] text-[var(--color-text-dim)]"}`} data-testid="workflow-status">
                {w.status}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-[var(--color-text)]" data-testid="workflows-closing">{WORKFLOWS_CLOSING}</p>
      </div>
    </div>
  );
}
