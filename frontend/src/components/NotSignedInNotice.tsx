import Link from "next/link";

import { ANONYMOUS_DEMO_BUTTON, ANONYMOUS_DEMO_NOTE, SIGN_IN_LINK_TEXT } from "@/lib/surfaceCopy";

/**
 * Shown when the engine says this browser is not signed in and nothing was sent: the way back is to sign in, or to choose the anonymous demo knowingly.
 * Used by Screening and Matters; the anonymous demo is never started without the user pressing the button.
 */
export function NotSignedInNotice({ message, onAnonymous }: { message: string; onAnonymous: () => void }) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm" role="alert" data-testid="not-signed-in">
      <p className="text-[var(--color-text)]">{message}</p>
      <p className="text-xs text-[var(--color-text-dim)]">{ANONYMOUS_DEMO_NOTE}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/signin" className="text-[var(--color-accent)] underline" data-testid="not-signed-in-signin">{SIGN_IN_LINK_TEXT}</Link>
        <button type="button" onClick={onAnonymous} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)]" data-testid="not-signed-in-anonymous">
          {ANONYMOUS_DEMO_BUTTON}
        </button>
      </div>
    </div>
  );
}
