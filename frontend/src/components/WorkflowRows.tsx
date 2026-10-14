"use client";

import { ASSISTANT_PAUSED_TEXT } from "@/lib/assistantTier";
import { WORKFLOWS, WORKFLOWS_CLOSING } from "@/lib/workflowsCopy";
import { useAssistantState } from "@/components/useAssistantTier";
import { pausedTreatment } from "@/lib/assistantTier";
import { ASSISTANT_ENTRY_ENABLED } from "@/lib/assistantFlag";

/** The assistant workflow (the first row) is greyed when the tier is PAUSED (configured but refused or over budget) or the health read did not answer; the one paused line shows only when PAUSED. Available and not-configured leave the page as it was. All of it only when the assistant is offered (the entry flag): otherwise the row keeps just its note and chip. */
export function WorkflowRows() {
  const state = useAssistantState();
  const { line: paused, grey: anyGreyed } = pausedTreatment(state, ASSISTANT_ENTRY_ENABLED);
  return (
    <>
      {paused && (
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="assistant-paused">{ASSISTANT_PAUSED_TEXT}</p>
      )}
      <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        {WORKFLOWS.map((w, i) => {
          const greyed = anyGreyed && i === 0;
          return (
            <li key={w.name} className={`flex flex-wrap items-baseline justify-between gap-2 p-3 ${greyed ? "opacity-60" : ""}`} data-testid="workflow-row" data-paused={greyed ? "true" : undefined}>
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{w.name}</div>
                {w.note && <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">{w.note}</div>}
              </div>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${w.status === "Building" ? "border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] text-[var(--color-warn)]" : "border-[var(--color-ok-border)] bg-[var(--color-ok-bg)] text-[var(--color-ok)]"}`} data-testid="workflow-status">
                {w.status}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-[var(--color-text)]" data-testid="workflows-closing">{WORKFLOWS_CLOSING}</p>
    </>
  );
}
