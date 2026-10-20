import Link from "next/link";

import { REGISTRY, REGISTRY_WORDS, registryAvailable, registryHref } from "@/lib/workflowRegistry";

/**
 * The workflows front door (Advisor Q6; only on a build with NEXT_PUBLIC_WORKFLOWS_V2=1): one card per engine workflow, the WHOLE card is the link to the tool, 1 column on a phone and 2 from md.
 * Each card has the title, R1's one line, an Available chip (a card that is not available shows Coming and is not a link), "Uses your papers" where the tool reads a matter's papers, and "Start here" on Papers for a matter.
 * Availability comes from the engine's status `workflows` field when it carries one; until then from the 0.6.23 set (lib/workflowRegistry.ts).
 */
export function WorkflowCards({ statusWorkflows = null }: { statusWorkflows?: Record<string, unknown> | null }) {
  const on = registryAvailable(statusWorkflows);
  return (
    <ul className="grid gap-4 md:grid-cols-2" data-testid="workflow-cards">
      {REGISTRY.map((e) => {
        const body = (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--color-text)]">{e.title}</h2>
              <span className={`text-xs font-medium ${on[e.key] ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)]"}`} data-testid="workflow-card-chip">{on[e.key] ? REGISTRY_WORDS.chipAvailable : REGISTRY_WORDS.chipComing}</span>
            </div>
            <p className="text-sm text-[var(--color-text-dim)]">{e.line}</p>
            {(e.usesPapers || e.startHere) && (
              <p className="flex flex-wrap gap-2 text-xs text-[var(--color-text-dim)]">
                {e.usesPapers && <span data-testid="workflow-card-papers">{REGISTRY_WORDS.tagUsesPapers}</span>}
                {e.startHere && <span className="font-medium text-[var(--color-text)]" data-testid="workflow-card-start">{REGISTRY_WORDS.startHere}</span>}
              </p>
            )}
          </>
        );
        const box = "flex h-full flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5";
        return (
          <li key={e.key} data-testid={`workflow-card-${e.key}`}>
            {on[e.key]
              ? <Link href={registryHref(e)} className={`${box} min-h-11 hover:bg-[var(--color-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}>{body}</Link>
              : <div className={`${box} border-dashed bg-transparent`}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
