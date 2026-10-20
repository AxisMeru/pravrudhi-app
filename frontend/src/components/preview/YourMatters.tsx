"use client";

import { useEffect, useState } from "react";

import { PREVIEW } from "@/lib/previewWorkflows";
import { parseMyMatters, previewPost, type MyMatter } from "@/lib/previewApi";
import { YOUR_MATTERS_TEXT as Y, confirmLine, matterLabel, papersCount } from "@/lib/yourMatters";

const BTN = "inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

/**
 * The signed-in organisation's matters, read from the engine (POST /matter-spans/my-matters): rows in the engine's order, numbered for this view only (never an id), each with its paper count, Open and a two-step Delete.
 * The list is a passive read: a 401 or 403 hides the section (nothing navigates away because the page was opened; the visitor's own actions still send them to sign in). A route that is not on (404, 405, 409, 501) hides the whole section: nothing is claimed that the engine cannot do. A truncated answer says so and never reads as the whole list.
 */
export function YourMatters({ current, onOpen, onDeleted }: { current: string | null; onOpen: (matterId: string) => void; onDeleted: (matterId: string) => void }) {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "off" } | { kind: "error" } | { kind: "list"; matters: MyMatter[]; truncated: boolean }>({ kind: "loading" });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void previewPost("/matter-spans/my-matters", {}, undefined, true).then((a) => {
      if (!live) return;
      if ([401, 403, 404, 405, 409, 501].includes(a.status)) return setState({ kind: "off" });
      const p = a.status === 200 ? parseMyMatters(a.body) : null;
      setState(p ? { kind: "list", matters: p.matters, truncated: p.truncated } : { kind: "error" });
    }).catch(() => { if (live) setState({ kind: "error" }); });
    return () => { live = false; };
  }, []);
  if (state.kind === "loading" || state.kind === "off") return null;
  const remove = async (id: string) => {
    setBusy(true); setMessage(null);
    try {
      const a = await previewPost("/matter-spans/delete", { matter_id: id });
      if (a.status !== 200 && a.status !== 404) return setMessage(PREVIEW.wf_error);
      setState((s) => (s.kind === "list" ? { ...s, matters: s.matters.filter((m) => m.matterId !== id) } : s));
      setConfirming(null); setMessage(Y.deleted); onDeleted(id);
    } catch { setMessage(PREVIEW.wf_error); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-labelledby="pv-yourmatters-heading" id="pv-yourmatters" data-testid="pv-yourmatters">
      <h2 id="pv-yourmatters-heading" className="text-base font-medium text-[var(--color-text)]">{Y.heading}</h2>
      {state.kind === "error" ? <p className="text-sm text-[var(--color-text)]" role="status" data-testid="pv-yourmatters-error">{PREVIEW.wf_error}</p> : (
        <>
          {state.matters.length === 0 && <p className="text-sm text-[var(--color-text)]" data-testid="pv-yourmatters-empty">{Y.empty}</p>}
          <ul className="space-y-2">
            {state.matters.map((m, i) => (
              <li key={m.matterId} className="space-y-2 text-sm text-[var(--color-text)]" data-testid="pv-yourmatters-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{matterLabel(i + 1)} <span className="text-[var(--color-text-dim)]">{papersCount(m.papers)}</span>{current === m.matterId && <span className="sr-only"> (open)</span>}</span>
                  <span className="flex gap-2">
                    <button type="button" className={BTN} onClick={() => onOpen(m.matterId)} disabled={busy} data-testid="pv-yourmatters-open">{Y.open}</button>
                    <button type="button" className={BTN} onClick={() => setConfirming(m.matterId)} disabled={busy} data-testid="pv-yourmatters-delete">{Y.delete}</button>
                  </span>
                </div>
                {confirming === m.matterId && (
                  <div role="alertdialog" aria-label={confirmLine(i + 1, m.papers)} className="space-y-2 rounded-md border border-[var(--color-border)] p-3" data-testid="pv-yourmatters-confirm">
                    <p>{confirmLine(i + 1, m.papers)}</p>
                    <span className="flex gap-2">
                      <button type="button" className={BTN} onClick={() => void remove(m.matterId)} disabled={busy} data-testid="pv-yourmatters-confirm-yes">{Y.confirmYes}</button>
                      <button type="button" className={BTN} onClick={() => setConfirming(null)} disabled={busy} data-testid="pv-yourmatters-confirm-cancel">{Y.confirmCancel}</button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {state.truncated && <p className="text-xs text-[var(--color-text-dim)]" data-testid="pv-yourmatters-truncated">{Y.truncated}</p>}
        </>
      )}
      {message && <p role="status" className="text-sm text-[var(--color-text)]" data-testid="pv-yourmatters-message">{message}</p>}
    </section>
  );
}
