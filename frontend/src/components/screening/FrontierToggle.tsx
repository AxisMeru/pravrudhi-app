"use client";

import { ASSISTANT_PAUSED_TEXT } from "@/lib/assistantTier";
import { FRONTIER_QUOTE_LIMIT_TEXT, FRONTIER_TOGGLE_LABEL, frontierToggleState } from "@/lib/frontierReader";

/** The opt-in frontier reader switch. Off by default; disabled with a plain reason until the engine says the reader is available. */
export function FrontierToggle({
  value,
  onChange,
  available,
  reason,
  provider,
  paused,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  available?: boolean | null;
  reason?: string | null;
  provider?: string | null;
  /** The assistant tier is paused (a configured tier that is refused or over budget): greyed, never checked, with the one paused line. */
  paused?: boolean;
}) {
  const s = frontierToggleState({ available, value, reason, provider, paused });
  return (
    <div className="space-y-1 text-sm" data-testid="frontier-toggle">
      <label className="inline-flex items-center gap-2 text-[var(--color-text)]">
        <input type="checkbox" checked={s.checked} disabled={s.disabled} onChange={(e) => onChange(e.target.checked)} />
        {FRONTIER_TOGGLE_LABEL}
      </label>
      <p className="text-xs text-[var(--color-text-dim)]" data-testid="frontier-limit">
        {FRONTIER_QUOTE_LIMIT_TEXT}
      </p>
      {paused && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="assistant-paused">
          {ASSISTANT_PAUSED_TEXT}
        </p>
      )}
      {s.reason && (
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="frontier-unavailable">
          {s.reason}
        </p>
      )}
      {s.consent && (
        <p className="text-xs text-[var(--color-warn)]" data-testid="frontier-consent">
          {s.consent}
        </p>
      )}
    </div>
  );
}
