"use client";

import { RUN_AGAIN_LABEL, RUN_AGAIN_NOTE, type RunAgainState } from "@/lib/runAgain";
import Link from "next/link";

import { DH_ASSIST_SIGNIN } from "@/lib/dataHandling";
import { ASSISTANT_DATA_LINK_TEXT, ASSISTANT_RUN_LABEL, entryState, STEP_LABELS, STEP_TRACE_HEADING, assistantConsentLine, assistantOutcomeLine, stepCheckText, type AssistantBlock } from "@/lib/assistantRun";
import { isGreyed, type AssistantState } from "@/lib/assistantTier";

/**
 * The assistant entry on Screening (#125), beside "Screen these facts". Not configured: nothing at all. Paused or unreachable: greyed (the paused line is the frontier toggle's, so it
 * shows once on the page). Available: a consent tick that is unticked on every load and after every run, with the consent line beside it every time; the button needs the tick.
 */
export function AssistantRun({
  state,
  signedIn,
  consent,
  onConsent,
  provider,
  busy,
  onRun,
  runAgain = "hidden",
}: {
  state: AssistantState;
  /** null until /api/me has answered. */
  signedIn: boolean | null;
  consent: boolean;
  onConsent: (next: boolean) => void;
  provider: string | null;
  /** A screening is in flight, or the service is closed or offline. */
  busy: boolean;
  onRun: () => void;
  /** "offered" after an assisted run's own timeout (lib/runAgain.ts): the same button reads Run again, with R1's note; it stays gated by the tick. */
  runAgain?: RunAgainState;
}) {
  const entry = entryState(state, true, signedIn);
  if (entry === "hidden") return null;
  if (entry === "signin") return <p className="text-xs text-[var(--color-text-dim)]" data-testid="assistant-signin">{DH_ASSIST_SIGNIN}</p>;
  const greyed = isGreyed(state);
  const usable = entry === "usable";
  return (
    <div className={`flex flex-col gap-2 text-sm ${greyed ? "opacity-60" : ""}`} data-testid="assistant-run" data-greyed={greyed ? "true" : undefined}>
      <label className="inline-flex items-start gap-2 text-[var(--color-text)]">
        <input type="checkbox" className="mt-1" checked={usable && consent} disabled={!usable || busy} onChange={(e) => onConsent(e.target.checked)} data-testid="assistant-consent" />
        <span data-testid="assistant-consent-line">{assistantConsentLine(provider)}</span>
      </label>
      <Link href="/data-handling#dh-assistant" className="w-fit text-xs text-[var(--color-accent)] underline" data-testid="assistant-data-link">
        {ASSISTANT_DATA_LINK_TEXT}
      </Link>
      <button
        type="button"
        onClick={onRun}
        disabled={!usable || !consent || busy}
        data-testid="assistant-run-button"
        className="w-fit rounded-md border border-[var(--color-control-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] disabled:opacity-50"
      >
        {runAgain === "offered" ? RUN_AGAIN_LABEL : ASSISTANT_RUN_LABEL}
      </button>
      {runAgain === "offered" && <p className="text-xs text-[var(--color-text-dim)]" data-testid="run-again-note">{RUN_AGAIN_NOTE}</p>}
    </div>
  );
}

/** After an assisted run: the one plain line for the outcome (none when it finished) and the fixed-word step trace. Nothing the assistant wrote is shown. */
export function AssistantTrace({ block, hideLine }: { block: AssistantBlock; hideLine?: boolean }) {
  const line = assistantOutcomeLine(block);
  const steps = block.used ? block.steps : [];
  return (
    <div className="flex flex-col gap-2" data-testid="assistant-result">
      {line && !hideLine && (
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="assistant-outcome-line">{line}</p>
      )}
      {steps.length > 0 && (
        <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm" data-testid="assistant-trace">
          <summary className="cursor-pointer font-medium text-[var(--color-text)]">{STEP_TRACE_HEADING}</summary>
          <ol className="mt-2 flex flex-col gap-1">
            {steps.map((s, i) => {
              const check = stepCheckText(s);
              return (
                <li key={i} data-testid="assistant-step" className="text-[var(--color-text)]">
                  {STEP_LABELS[s.name]}
                  {check && <span className="text-[var(--color-text-dim)]">: {check}</span>}
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </div>
  );
}
