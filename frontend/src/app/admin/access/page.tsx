"use client";

import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { ACCESS_COPY as C } from "@/lib/adminAccess/copy";
import {
  blockAccount, cleanEmail, fetchAccessList, inviteAccount, messageFor, resendInvitation, showInviteControls, PAGE_SIZE,
  type AccessList, type ActionResult,
} from "@/lib/adminAccess/adminAccess";
import { edition } from "@/lib/edition";

type View = { kind: "loading" } | { kind: "hidden" } | { kind: "error" } | { kind: "ok"; list: AccessList };

const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : C.never);

/** Admin → Access (app#520): the accounts that can sign in; invite by email, send an invitation again, block. Hidden unless the engine calls the caller an administrator and the feature is on. No model-start switch, no delete, no un-block. */
export default function AccessPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [offset, setOffset] = useState(0);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);

  const load = useCallback(async (at: number) => {
    setView({ kind: "loading" });
    const r = await fetchAccessList(at);
    if (r.kind === "ok") setView({ kind: "ok", list: r.list });
    else if (r.kind === "unavailable") setView({ kind: "error" });
    else setView({ kind: "hidden" });
  }, []);

  useEffect(() => {
    let live = true;
    void edition().then((e) => {
      if (!live) return;
      const admin = e.access === "admin";
      setIsAdmin(admin);
      if (admin) void load(0);
    });
    return () => { live = false; };
  }, [load]);

  async function run(action: () => Promise<ActionResult>, okText: string) {
    setBusy(true);
    setNote(null);
    const r = await action();
    setBusy(false);
    setConfirmBlock(null);
    if (r.ok) {
      setNote({ kind: "ok", text: okText });
      await load(offset);
    } else {
      setNote({ kind: "error", text: r.message || messageFor(r.code) });
    }
  }

  function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanEmail(email);
    if (!clean) {
      setEmailError(messageFor("invalid_email"));
      return;
    }
    setEmailError(null);
    void run(async () => {
      const r = await inviteAccount(clean);
      if (r.ok) setEmail("");
      return r;
    }, C.invitedOk);
  }

  if (isAdmin === null) return <div className="p-8 text-sm text-[var(--color-text-dim)]" data-testid="access-loading">{C.loading}</div>;
  if (!isAdmin) return <div className="p-8 text-sm text-[var(--color-text-dim)]" data-testid="access-not-admin">{C.notAdmin}</div>;
  // The feature is off (a 404 or a non-JSON answer): nothing is shown, not even a heading.
  if (view.kind === "hidden") return null;

  const list = view.kind === "ok" ? view.list : null;
  const controls = list ? showInviteControls(true, list.wakePolicy) : false;

  return (
    <div data-testid="access-page">
      <PageHeader title={C.heading} subtitle={C.intro} />
      <div className="space-y-6 px-4 py-6 sm:px-8">
        {view.kind === "loading" && <p className="text-sm text-[var(--color-text-dim)]">{C.loading}</p>}
        {view.kind === "error" && (
          <div role="alert" className="text-sm text-[var(--color-danger)]" data-testid="access-load-error">
            <p>{C.loadError}</p>
            <button type="button" onClick={() => void load(offset)} className="mt-2 inline-flex min-h-6 items-center rounded border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text)] max-md:min-h-11">{C.retry}</button>
          </div>
        )}
        {list && (
          <>
            <p className="text-sm text-[var(--color-text)]" data-testid="access-policy">{list.wakePolicy === "any_signed_in" ? C.policyAnySignedIn : C.policyAllowlist}</p>

            {controls && (
              <form onSubmit={submitInvite} className="space-y-2" data-testid="access-invite">
                <h2 className="text-base font-medium text-[var(--color-text)]">{C.inviteHeading}</h2>
                <p className="text-sm text-[var(--color-text-dim)]">{C.inviteExplain}</p>
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
                </div>
                {emailError && <p id="access-email-error" role="alert" className="text-sm text-[var(--color-danger)]" data-testid="access-email-error">{emailError}</p>}
              </form>
            )}

            {note && (
              <p role={note.kind === "error" ? "alert" : "status"} className={`text-sm ${note.kind === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"}`} data-testid="access-note">{note.text}</p>
            )}
            {busy && <p className="text-sm text-[var(--color-text-dim)]">{C.working}</p>}

            <section>
              <h2 className="text-base font-medium text-[var(--color-text)]">{C.listHeading}</h2>
              {list.accounts.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-text-dim)]">{C.empty}</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--color-border)] rounded border border-[var(--color-border)]" data-testid="access-accounts">
                  {list.accounts.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" data-testid="access-account">
                      <div className="min-w-0">
                        <div className="break-all font-medium text-[var(--color-text)]">{a.email}</div>
                        <div className="text-xs text-[var(--color-text-dim)]">
                          {a.role === "admin" ? C.roleAdmin : C.roleMember} · {a.blocked ? C.statusBlocked : a.invite_state === "pending" ? C.statusPending : C.statusAccepted} · {C.createdOn} {day(a.created_at)} · {C.lastSignIn} {day(a.last_sign_in_at)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {a.blocked && <span className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs" data-testid="access-blocked-badge">{C.statusBlocked}</span>}
                        {a.invite_state === "pending" && !a.blocked && <span className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs" data-testid="access-pending-badge">{C.statusPending}</span>}
                        {controls && a.invite_state === "pending" && !a.blocked && (
                          <button type="button" disabled={busy} onClick={() => void run(() => resendInvitation(a.id), C.resentOk)} className="inline-flex min-h-6 items-center rounded border border-[var(--color-border)] px-3 py-1 text-xs max-md:min-h-11" data-testid="access-resend">{C.resendButton}</button>
                        )}
                        {a.role !== "admin" && !a.blocked && (
                          confirmBlock === a.id ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-[var(--color-text-dim)]" data-testid="access-block-explain">{C.blockExplain}</span>
                              <button type="button" disabled={busy} onClick={() => void run(() => blockAccount(a.id), C.blockedOk)} className="inline-flex min-h-6 items-center rounded border border-[var(--color-danger)] px-3 py-1 text-xs text-[var(--color-danger)] max-md:min-h-11" data-testid="access-block-confirm">{C.blockConfirm}</button>
                              <button type="button" onClick={() => setConfirmBlock(null)} className="inline-flex min-h-6 items-center rounded border border-[var(--color-border)] px-3 py-1 text-xs max-md:min-h-11">{C.blockCancel}</button>
                            </span>
                          ) : (
                            <button type="button" disabled={busy} onClick={() => setConfirmBlock(a.id)} className="inline-flex min-h-6 items-center rounded border border-[var(--color-border)] px-3 py-1 text-xs max-md:min-h-11" data-testid="access-block">{C.blockButton}</button>
                          )
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {(offset > 0 || list.nextOffset !== null) && (
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={offset === 0 || busy} onClick={() => { const o = Math.max(0, offset - PAGE_SIZE); setOffset(o); void load(o); }} className="inline-flex min-h-6 items-center rounded border border-[var(--color-border)] px-3 py-1 text-xs max-md:min-h-11" data-testid="access-prev">{C.pagePrev}</button>
                  <button type="button" disabled={list.nextOffset === null || busy} onClick={() => { const o = list.nextOffset ?? 0; setOffset(o); void load(o); }} className="inline-flex min-h-6 items-center rounded border border-[var(--color-border)] px-3 py-1 text-xs max-md:min-h-11" data-testid="access-next">{C.pageNext}</button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
