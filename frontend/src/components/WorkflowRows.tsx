"use client";

import { ASSISTANT_PAUSED_TEXT } from "@/lib/assistantTier";
import { WORKFLOWS, WORKFLOWS_CLOSING } from "@/lib/workflowsCopy";
import { useAssistantTier } from "@/components/useAssistantTier";

/** The assistant workflow (the first row) is greyed while the assistant tier is not available, with the one paused line above the list. Every other row is unchanged. */
export function WorkflowRows() {
  const assistant = useAssistantTier();
  const paused = assistant.tier !== "available";
  return (
    <>
      {paused && assistant.loaded && (
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="assistant-paused">{ASSISTANT_PAUSED_TEXT}</p>
      )}
      <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        {WORKFLOWS.map((w, i) => {
          const greyed = paused && i === 0;
          return (
            <li key={w.name} className={`flex flex-wrap items-baseline justify-between gap-2 p-3 ${greyed ? "opacity-60" : ""}`} data-testid="workflow-row" data-paused={greyed ? "true" : undefined}>
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{w.name}</div>
                {w.note && <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">{w.note}</div>}
              </div>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${w.status === "Building" ? "border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] text-[var(--color-warn)]" : "border-[var(--color-control-border)] text-[var(--color-text-dim)]"}`} data-testid="workflow-status">
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
