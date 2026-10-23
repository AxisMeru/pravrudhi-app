"use client";

import { useState } from "react";
import { MIN_PASSWORD_LENGTH, checkNewPassword, setPassword } from "@/lib/password";
import { FAILURE_TEXT, PASSWORD_COPY, PROBLEM_TEXT } from "@/lib/passwordCopy";

const FIELD = "mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]";

/**
 * New password + confirmation (app d65). Used to set a password after an invitation or recovery link, and to change it in Settings. The values live only in this component's state while it is on screen:
 * they are never logged, never stored and never put in a URL; they leave in the body of one PUT.
 */
export function PasswordForm({ mode, onDone }: { mode: "set" | "change"; onDone: () => void }) {
  const [password, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = checkNewPassword(password, confirm);
    if (problem) { setError(PROBLEM_TEXT[problem]); return; }
    setBusy(true);
    const result = await setPassword(password);
    setBusy(false);
    if (result.ok) {
      setPw("");
      setConfirm("");
      setSaved(true);
      onDone();
    } else {
      setError(FAILURE_TEXT[result.reason]);
    }
  }

  const button = mode === "set" ? PASSWORD_COPY.setButton : PASSWORD_COPY.changeButton;
  return (
    <form onSubmit={submit} className="space-y-4" data-testid={`password-form-${mode}`} noValidate>
      {error && <p role="alert" className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger)]" data-testid="password-error">{error}</p>}
      {saved && mode === "change" && <p role="status" className="text-sm text-[var(--color-text)]" data-testid="password-changed">{PASSWORD_COPY.changed}</p>}
      <div>
        <label htmlFor={`pw-new-${mode}`} className="block text-sm font-medium text-[var(--color-text)]">{PASSWORD_COPY.newLabel}</label>
        <input id={`pw-new-${mode}`} type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPw(e.target.value)} className={FIELD} disabled={busy} aria-describedby={`pw-hint-${mode}`} />
        <p id={`pw-hint-${mode}`} className="mt-1 text-sm text-[var(--color-text-dim)]">{PASSWORD_COPY.hint}</p>
      </div>
      <div>
        <label htmlFor={`pw-confirm-${mode}`} className="block text-sm font-medium text-[var(--color-text)]">{PASSWORD_COPY.confirmLabel}</label>
        <input id={`pw-confirm-${mode}`} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} disabled={busy} />
      </div>
      <button type="submit" disabled={busy} className="rounded-md bg-text px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50">
        {busy ? PASSWORD_COPY.busy : button}
      </button>
    </form>
  );
}
