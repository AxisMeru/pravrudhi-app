"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { PreviewBadge } from "@/components/PreviewBadge";
import { PREVIEW } from "@/lib/previewWorkflows";
import { PREVIEW_PAGE as T } from "@/lib/previewPageCopy";
import { matterIdOf, parseAgenda, parsePapers, previewPost, str, type PaperRow } from "@/lib/previewApi";

const KEY = "preview.matter";
const BTN = "inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
const FIELD = "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]";

/** Why a preview call did not give a result, in R1's lines (previewWorkflows.ts); the engine's own `detail` sentence is added when it sent one. */
function refusal(status: number, body: Record<string, unknown> | null, noPapers = false): string {
  const detail = str(body?.detail);
  if (status === 404) return PREVIEW.wf_unavailable;
  if (status === 409 && (body?.error === "no_papers" || noPapers)) return PREVIEW.wf_no_papers;
  if (status === 429 || status === 503) return detail ?? PREVIEW.wf_busy;
  return detail ?? PREVIEW.wf_error;
}

export default function PreviewPage() {
  const [matter, setMatter] = useState<string | null>(null);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [pagesNote, setPagesNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<{ key: string; lines: string[] }[] | null>(null);

  useEffect(() => {
    let m: string | null = null;
    try { m = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
    if (!m || !/^[0-9a-f]{32}$/.test(m)) return;
    const id = m;
    void (async () => { await Promise.resolve(); setMatter(id); await refresh(id); })();
  }, []);

  async function refresh(m: string) {
    const a = await previewPost("/matter-spans/list", { matter_id: m });
    if (a.status === 200) { const p = parsePapers(a.body); setPapers(p.papers); setPagesNote(p.pagesNote); }
    else if (a.status === 404) { setMatter(null); setPapers([]); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
  }
  async function run<R>(f: () => Promise<R>): Promise<R | null> {
    setBusy(true); setMessage(null);
    try { return await f(); } catch { setMessage(PREVIEW.wf_error); return null; } finally { setBusy(false); }
  }
  const start = () => run(async () => {
    const a = await previewPost("/matter-spans/matters", {});
    const id = matterIdOf(a.body);
    if (a.status !== 200 || !id) return setMessage(refusal(a.status, a.body));
    setMatter(id); setPapers([]); setAgenda(null); setMessage(T.matterStarted);
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  });
  const addPaper = () => run(async () => {
    if (!matter || !text.trim()) return;
    const a = await previewPost("/matter-spans/documents", { matter_id: matter, text, name: name.trim().slice(0, 200) || "paper" });
    if (a.status !== 200) return setMessage(refusal(a.status, a.body));
    setText(""); setName(""); await refresh(matter);
  });
  const removePaper = (docId: string) => run(async () => {
    if (!matter) return;
    const a = await previewPost("/matter-spans/delete", { matter_id: matter, doc_id: docId });
    if (a.status !== 200) return setMessage(refusal(a.status, a.body));
    await refresh(matter);
  });
  const removeAll = () => run(async () => {
    if (!matter) return;
    const a = await previewPost("/matter-spans/delete", { matter_id: matter });
    if (a.status !== 200) return setMessage(refusal(a.status, a.body));
    setMatter(null); setPapers([]); setAgenda(null);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  });
  const runAgenda = () => run(async () => {
    if (!matter) return;
    const a = await previewPost("/quashing-agenda", { matter_id: matter, relief: "quash_fir_or_complaint" });
    if (a.status !== 200) { setAgenda(null); return setMessage(refusal(a.status, a.body)); }
    const parsed = parseAgenda(a.body);
    if (!parsed) return setMessage(PREVIEW.wf_error);
    setAgenda(parsed);
  });

  return (
    <div>
      <PageHeader title={T.title} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8" data-testid="preview-page">
        <PreviewBadge line />
        <section className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-labelledby="pv-matter-heading" data-testid="pv-matter">
          <h2 id="pv-matter-heading" className="text-base font-medium text-[var(--color-text)]">{T.matterHeading}</h2>
          {!matter ? (
            <button type="button" className={BTN} onClick={start} disabled={busy} data-testid="pv-start">{T.startMatter}</button>
          ) : (
            <>
              <label className="block text-sm text-[var(--color-text)]">{T.paperNameLabel}
                <input className={FIELD} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} data-testid="pv-name" />
              </label>
              <label className="block text-sm text-[var(--color-text)]">{T.paperTextLabel}
                <textarea className={`${FIELD} min-h-32`} value={text} onChange={(e) => setText(e.target.value)} data-testid="pv-text" />
              </label>
              <button type="button" className={BTN} onClick={addPaper} disabled={busy || !text.trim()} data-testid="pv-add">{T.addPaper}</button>
              {papers.length > 0 && (
                <div data-testid="pv-papers">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">{T.papersHeading}</h3>
                  <ul className="mt-1 space-y-1 text-sm text-[var(--color-text)]">
                    {papers.map((p) => (
                      <li key={p.docId} className="flex items-center justify-between gap-2">
                        <span className="break-words">{p.name}</span>
                        <button type="button" className={BTN} onClick={() => removePaper(p.docId)} disabled={busy}>{T.removePaper}</button>
                      </li>
                    ))}
                  </ul>
                  {pagesNote && <p className="mt-2 text-xs text-[var(--color-text-dim)]" data-testid="pv-pages-note">{pagesNote}</p>}
                </div>
              )}
              <button type="button" className={BTN} onClick={removeAll} disabled={busy} data-testid="pv-remove-all">{T.removeAll}</button>
            </>
          )}
          {message && <p role="status" className="text-sm text-[var(--color-text)]" data-testid="pv-message">{message}</p>}
        </section>
        <section className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-labelledby="pv-s3-heading" data-testid="pv-s3">
          <h2 id="pv-s3-heading" className="flex flex-wrap items-center gap-2 text-base font-medium text-[var(--color-text)]">{T.s3Name} <PreviewBadge /></h2>
          <p className="text-sm text-[var(--color-text)]">{T.s3Line}</p>
          <button type="button" className={BTN} onClick={runAgenda} disabled={busy || !matter} data-testid="pv-s3-run">{busy ? T.working : T.s3Run}</button>
          {agenda && (
            <div className="space-y-2" data-testid="pv-s3-result">
              {agenda.map((f) => (
                <div key={f.key} data-testid={`pv-s3-${f.key}`}>{f.lines.map((l, i) => <p key={i} className="text-sm text-[var(--color-text)]">{l}</p>)}</div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
