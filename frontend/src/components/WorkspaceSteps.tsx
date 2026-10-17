import { WORKSPACE_STEPS_LABEL, workspaceSteps } from "@/lib/workspace";

/** The step bar at the top of the Matter workspace: each step with its state; an available step links to its place on the page, a step that is not available yet says why. */
export function WorkspaceSteps({ hasFacts, hasResult, className = "" }: { hasFacts: boolean; hasResult: boolean; className?: string }) {
  const steps = workspaceSteps({ hasFacts, hasResult });
  return (
    <nav aria-label={WORKSPACE_STEPS_LABEL} className={`print:hidden ${className}`.trim()} data-testid="workspace-steps">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.key} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2" data-testid={`step-${s.key}`} data-state={s.state}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                <span className="mr-1 text-[var(--color-text-dim)]">{i + 1}</span>
                {s.href ? <a href={s.href} className="inline-flex min-h-6 items-center underline max-md:min-h-11" data-testid={`step-link-${s.key}`}>{s.label}</a> : s.label}
              </span>
              <span className="text-xs text-[var(--color-text-dim)]" data-testid={`step-state-${s.key}`}>{s.state}</span>
            </div>
            {s.note && <p className="mt-1 text-xs text-[var(--color-text-dim)]" data-testid={`step-note-${s.key}`}>{s.note}</p>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
