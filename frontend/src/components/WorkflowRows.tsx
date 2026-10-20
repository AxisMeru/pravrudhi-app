"use client";

import Link from "next/link";

import { ASSISTANT_PAUSED_TEXT } from "@/lib/assistantTier";
import { ASSISTANT_WORKFLOW_NAME, WORKFLOWS, WORKFLOWS_CLOSING, WORKFLOW_NOT_OFFERED, workflowLink } from "@/lib/workflowsCopy";
import { START_PANEL_HEADING } from "@/lib/screening/copy";
import { WORKSPACE_PATH } from "@/lib/workspace";
import { useAssistantState } from "@/components/useAssistantTier";
import { pausedTreatment } from "@/lib/assistantTier";
import { ASSISTANT_ENTRY_ENABLED } from "@/lib/assistantFlag";
import { WORKFLOWS_V2 } from "@/lib/workflowsV2Flag";
import { WorkflowCards } from "@/components/WorkflowCards";
import { useEngineWorkflows } from "@/lib/useEngineWorkflows";
import { readMap } from "@/lib/workflowRegistry";

/** The assistant workflow (the first row) is greyed when the tier is PAUSED (configured but refused or over budget) or the health read did not answer; the one paused line shows only when PAUSED. Available and not-configured leave the page as it was. All of it only when the assistant is offered (the entry flag): otherwise the row keeps just its note and chip. */
export function WorkflowRows() {
  const state = useAssistantState();
  const engineWorkflows = useEngineWorkflows();
  const { line: paused, grey: anyGreyed } = pausedTreatment(state, ASSISTANT_ENTRY_ENABLED);
  return (
    <>
      {paused && (
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="assistant-paused">{ASSISTANT_PAUSED_TEXT}</p>
      )}
      <Link href={WORKSPACE_PATH} className="inline-flex min-h-6 w-fit items-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-accent)] max-md:min-h-11" data-testid="workflows-start">{START_PANEL_HEADING}</Link>
      {WORKFLOWS_V2 && <WorkflowCards statusWorkflows={readMap(engineWorkflows)} />}
      <ul className="grid gap-4 md:grid-cols-2">
        {WORKFLOWS.map((w) => {
          const greyed = anyGreyed && w.name === ASSISTANT_WORKFLOW_NAME;
                    return (
            <li key={w.name} className={`flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${greyed ? "border-dashed bg-transparent [&_h2]:text-[var(--color-text-dim)]" : ""}`} data-testid="workflow-row" data-paused={greyed ? "true" : undefined} data-status={w.status}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div><h2 className="text-base font-semibold text-[var(--color-text)]">{w.name}</h2>{w.label && <span className="ml-2 text-xs text-[var(--color-text-dim)]" data-testid="workflow-label">{w.label}</span>}</div>
                {w.status === "Building" && <span className="text-xs font-medium text-[var(--color-text-dim)]" data-testid="workflow-status">{WORKFLOW_NOT_OFFERED}</span>}
              </div>
              {w.note && <p className="text-sm text-[var(--color-text-dim)]">{w.note}</p>}
              {w.status === "Built" && workflowLink(w.name) && (
                <Link href={workflowLink(w.name)!.href} className="mt-auto inline-flex min-h-6 w-fit items-center rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-accent)] underline max-md:min-h-11" data-testid="workflow-open">{workflowLink(w.name)!.label}</Link>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-[var(--color-text)]" data-testid="workflows-closing">{WORKFLOWS_CLOSING}</p>
    </>
  );
}
