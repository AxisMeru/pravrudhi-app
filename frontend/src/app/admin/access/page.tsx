"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { ACCESS_COPY as C } from "@/lib/adminAccess/copy";
import { cleanEmail, inviteAccount, messageFor, resendInvitation, type ActionResult } from "@/lib/adminAccess/adminAccess";
import { edition } from "@/lib/edition";

/** Admin → Access (app#520, minimal): one address box with Send invitation and Send again, the result in plain words. Shown only when the engine calls the caller an administrator (/api/me access). No list, no block, no model-start switch. */
export default function AccessPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void edition().then((e) => { if (live) setIsAdmin(e.access === "admin"); });
    return () => { live = false; };
  }, []);

  async function run(action: (clean: string) => Promise<ActionResult>, okText: string) {
    const clean = cleanEmail(email);
    if (!clean) {
      setEmailError(messageFor("invalid_email"));
      return;
    }
    setEmailError(null);
    setBusy(true);
    setNote(null);
    const r = await action(clean);
    setBusy(false);
    if (r.ok) {
      setNote({ kind: "ok", text: okText });
      setEmail("");
    } else {
      setNote({ kind: "error", text: r.message || messageFor(r.code) });
    }
  }

  if (isAdmin === null) return <div className="p-8 text-sm text-[var(--color-text-dim)]" data-testid="access-loading">{C.loading}</div>;
  if (!isAdmin) return <div className="p-8 text-sm text-[var(--color-text-dim)]" data-testid="access-not-admin">{C.notAdmin}</div>;

  return (
    <div data-testid="access-page">
      <PageHeader title={C.heading} subtitle={C.intro} />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        <form onSubmit={(e) => { e.preventDefault(); void run(inviteAccount, C.invitedOk); }} className="space-y-2" data-testid="access-invite">
          <h2 className="text-base font-medium text-[var(--color-text)]">{C.inviteHeading}</h2>
          <p className="text-sm text-[var(--color-text-dim)]">{C.inviteExplain}</p>
          <p className="text-sm text-[var(--color-text-dim)]">{C.resendExplain}</p>
          <label className="block text-sm text-[var(--color-text)]" htmlFor="access-email">{C.inviteLabel}</label>
          <div className="flex flex-wrap gap-2">
            <input
              id="access-email"
              type="text"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={C.invitePlaceholder}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "access-email-error" : undefined}
              className="min-h-6 w-72 max-w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm max-md:min-h-11"
            />
            <button type="submit" disabled={busy} className="inline-flex min-h-6 items-center rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-on-accent)] max-md:min-h-11" data-testid="access-invite-send">{C.inviteButton}</button>
            <button type="button" disabled={busy} onClick={() => void run(resendInvitation, C.resentOk)} className="inline-flex min-h-6 items-center rounded border border-[var(--color-border)] px-4 py-1.5 text-sm max-md:min-h-11" data-testid="access-resend">{C.resendButton}</button>
          </div>
          {emailError && <p id="access-email-error" role="alert" className="text-sm text-[var(--color-danger)]" data-testid="access-email-error">{emailError}</p>}
        </form>
        {busy && <p className="text-sm text-[var(--color-text-dim)]">{C.working}</p>}
        {note && (
          <p role={note.kind === "error" ? "alert" : "status"} className={`text-sm ${note.kind === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"}`} data-testid="access-note">{note.text}</p>
        )}
      </div>
    </div>
  );
}
