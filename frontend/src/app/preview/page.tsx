"use client";

import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { PreviewBadge } from "@/components/PreviewBadge";
import { A1Result, A3Result, A5Result, B3Result, S1Result } from "@/components/preview/Viewers";
import { PREVIEW } from "@/lib/previewWorkflows";
import { PREVIEW_PAGE as T } from "@/lib/previewPageCopy";
import { MATTER_NOTE } from "@/lib/previewMatterNote";
import { B3_MODES, PREVIEW_MORE as M } from "@/lib/previewMoreCopy";
import { parseA1, parseA3, parseA5, parseB3, parseS1, type A1View, type A3View, type A5View, type B3View, type S1View } from "@/lib/previewParsers";
import { matterIdOf, parseAgenda, parsePapers, previewPost, str, type PaperRow } from "@/lib/previewApi";

const BTN = "inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
const FIELD = "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]";
const BOX = "space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
type Answer = Record<string, unknown> | null;

/** Why a preview call did not give a result, in R1's lines (previewWorkflows.ts); the engine's own `detail` sentence is used when it sent one for a busy or failed call. */
function refusal(status: number, body: Answer): string {
  const detail = str(body?.detail);
  if (status === 404) return PREVIEW.wf_unavailable;
  if (status === 409 && body?.error === "no_papers") return PREVIEW.wf_no_papers;
  if (status === 429 || status === 503) return detail ?? PREVIEW.wf_busy;
  return detail ?? PREVIEW.wf_error;
}

function Card({ id, name, line, children }: { id: string; name: string; line: string; children: React.ReactNode }) {
  return (
    <section className={BOX} aria-labelledby={`pv-${id}-heading`} data-testid={`pv-${id}`}>
      <h2 id={`pv-${id}-heading`} className="flex flex-wrap items-center gap-2 text-base font-medium text-[var(--color-text)]">{name} <PreviewBadge /></h2>
      <p className="text-sm text-[var(--color-text)]">{line}</p>
      {children}
    </section>
  );
}

const GONE_LINE = MATTER_NOTE.matter_gone;

const B3_FIELDS: [string, string][] = [["cheque", M.b3Cheque], ["presentation", M.b3Presentation], ["memo", M.b3Memo], ["information", M.b3Information], ["notice", M.b3Notice], ["receipt", M.b3Receipt]];

export default function PreviewPage() {
  const [matter, setMatter] = useState<string | null>(null);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [pagesNote, setPagesNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<{ key: string; lines: string[] }[] | null>(null);
  const [a5, setA5] = useState<A5View | null>(null);
  const [a3, setA3] = useState<A3View | null>(null);
  const [s1, setS1] = useState<S1View | null>(null);
  const [a1, setA1] = useState<A1View | null>(null);
  const [draft, setDraft] = useState("");
  const [b3, setB3] = useState<B3View | null>(null);
  const [b3f, setB3f] = useState<Record<string, string>>({ cheque: "", presentation: "", memo: "", information: "", notice: "", receipt: "", validity: "", mode: "" });

  async function refresh(m: string) {
    const a = await previewPost("/matter-spans/list", { matter_id: m });
    if (a.status === 200) { const p = parsePapers(a.body); setPapers(p.papers); setPagesNote(p.pagesNote); }
    else if (a.status === 404) { setMatter(null); setPapers([]); setMessage(GONE_LINE); }
  }
  async function run(f: () => Promise<void>): Promise<void> {
    setBusy(true); setMessage(null);
    try { await f(); } catch { setMessage(PREVIEW.wf_error); } finally { setBusy(false); }
  }
  const clearResults = () => { setAgenda(null); setA5(null); setA3(null); setS1(null); };
  const start = () => run(async () => {
    const a = await previewPost("/matter-spans/matters", {});
    const id = matterIdOf(a.body);
    if (a.status !== 200 || !id) return setMessage(refusal(a.status, a.body));
    setMatter(id); setPapers([]); clearResults(); setMessage(T.matterStarted);
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
    setMatter(null); setPapers([]); clearResults();
  });
  /** A 404 on a matter workflow can mean the store no longer holds the matter (a restart): check with the list route and, if it is gone, start over and say so. */
  const matterGone = async (m: string): Promise<boolean> => {
    const l = await previewPost("/matter-spans/list", { matter_id: m });
    if (l.status !== 404) return false;
    setMatter(null); setPapers([]); clearResults(); setMessage(GONE_LINE);
    return true;
  };
  const runOnMatter = <V,>(path: string, parse: (b: Answer) => V | null, set: (v: V | null) => void, extra: Record<string, unknown> = {}) => run(async () => {
    if (!matter) return;
    const a = await previewPost(path, { matter_id: matter, ...extra });
    if (a.status === 404 && (await matterGone(matter))) return;
    if (a.status !== 200) { set(null); return setMessage(refusal(a.status, a.body)); }
    const v = parse(a.body);
    if (!v) return setMessage(PREVIEW.wf_error);
    set(v);
  });
  const runA1 = () => run(async () => {
    if (!draft.trim()) return;
    const a = await previewPost("/draft-citation-check", { text: draft });
    if (a.status !== 200) { setA1(null); return setMessage(refusal(a.status, a.body)); }
    const v = parseA1(a.body);
    if (!v) return setMessage(PREVIEW.wf_error);
    setA1(v);
  });
  // B3: every date is sent as typed with source "typed"; a date is confirmed only by sending it again with confirmed_as equal to the engine's own reading (read_as) that the user pressed Confirm on.
  const runB3 = (confirmed: Record<string, string>) => run(async () => {
    const one = (key: string) => { const value = b3f[key].trim(); return value ? [{ value, source: "typed", ...(confirmed[key] ? { confirmed: true, confirmed_as: confirmed[key] } : { confirmed: false }) }] : []; };
    const body: Record<string, unknown> = { presentations: one("presentation"), return_memos: one("memo"), information_received: one("information"), notices: one("notice"), notice_receipts: one("receipt") };
    const cheque = one("cheque")[0];
    if (cheque) body.cheque_date = cheque;
    const months = Number(b3f.validity);
    if (b3f.validity.trim() && Number.isInteger(months) && months >= 1 && months <= 60) body.validity_months = months;
    if (b3f.mode) body.notice_mode = b3f.mode;
    const a = await previewPost("/s138-checklist", body);
    if (a.status !== 200) { setB3(null); return setMessage(refusal(a.status, a.body)); }
    const v = parseB3(a.body);
    if (!v) return setMessage(PREVIEW.wf_error);
    setB3(v);
    setB3c(confirmed);
  });
  const [b3c, setB3c] = useState<Record<string, string>>({});
  const confirmB3 = (i: { text: string; readAs: string }) => {
    const key = B3_FIELDS.map(([k]) => k).find((k) => b3f[k].trim() === i.text && !b3c[k]);
    if (key) void runB3({ ...b3c, [key]: i.readAs });
  };
  const editB3 = (k: string, v: string) => { setB3f((f) => ({ ...f, [k]: v })); setB3c((c) => { const n = { ...c }; delete n[k]; return n; }); };

  return (
    <div>
      <PageHeader title={T.title} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8" data-testid="preview-page">
        <PreviewBadge line />
        <section className={BOX} aria-labelledby="pv-matter-heading" data-testid="pv-matter">
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
          <p className="text-xs text-[var(--color-text-dim)]" data-testid="pv-matter-note">{MATTER_NOTE.matter_note}</p>
          {message && <p role="status" className="text-sm text-[var(--color-text)]" data-testid="pv-message">{message}</p>}
        </section>

        <Card id="s3" name={T.s3Name} line={T.s3Line}>
          <button type="button" className={BTN} onClick={() => runOnMatter("/quashing-agenda", (b) => parseAgenda(b), setAgenda, { relief: "quash_fir_or_complaint" })} disabled={busy || !matter} data-testid="pv-s3-run">{busy ? T.working : T.s3Run}</button>
          {agenda && (
            <div className="space-y-2" data-testid="pv-s3-result">
              {agenda.map((f) => (
                <div key={f.key} data-testid={`pv-s3-${f.key}`}>{f.lines.map((l, i) => <p key={i} className="text-sm text-[var(--color-text)]">{l}</p>)}</div>
              ))}
            </div>
          )}
        </Card>

        <Card id="a5" name={M.a5Name} line={M.a5Line}>
          <button type="button" className={BTN} onClick={() => runOnMatter("/review-agenda", parseA5, setA5)} disabled={busy || !matter} data-testid="pv-a5-run">{M.a5Run}</button>
          {a5 && <A5Result v={a5} />}
        </Card>

        <Card id="a3" name={M.a3Name} line={M.a3Line}>
          <button type="button" className={BTN} onClick={() => runOnMatter("/chronology", parseA3, setA3)} disabled={busy || !matter} data-testid="pv-a3-run">{M.a3Run}</button>
          {a3 && <A3Result v={a3} />}
        </Card>

        <Card id="s1" name={M.s1Name} line={M.s1Line}>
          <button type="button" className={BTN} onClick={() => runOnMatter("/matter-citation-sweep", parseS1, setS1)} disabled={busy || !matter} data-testid="pv-s1-run">{M.s1Run}</button>
          {s1 && <S1Result v={s1} />}
        </Card>

        <Card id="a1" name={M.a1Name} line={M.a1Line}>
          <label className="block text-sm text-[var(--color-text)]">{M.a1Label}
            <textarea className={`${FIELD} min-h-32`} value={draft} onChange={(e) => setDraft(e.target.value)} data-testid="pv-a1-text" />
          </label>
          <button type="button" className={BTN} onClick={runA1} disabled={busy || !draft.trim()} data-testid="pv-a1-run">{M.a1Run}</button>
          {a1 && <A1Result v={a1} />}
        </Card>

        <Card id="b3" name={M.b3Name} line={M.b3Line}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {B3_FIELDS.map(([k, label]) => (
              <label key={k} className="block text-sm text-[var(--color-text)]">{label}
                <input className={FIELD} value={b3f[k]} maxLength={120} onChange={(e) => editB3(k, e.target.value)} data-testid={`pv-b3-${k}`} />
              </label>
            ))}
            <label className="block text-sm text-[var(--color-text)]">{M.b3Validity}
              <input className={FIELD} inputMode="numeric" value={b3f.validity} maxLength={2} onChange={(e) => setB3f((f) => ({ ...f, validity: e.target.value }))} data-testid="pv-b3-validity" />
            </label>
            <label className="block text-sm text-[var(--color-text)]">{M.b3Mode}
              <select className={FIELD} value={b3f.mode} onChange={(e) => setB3f((f) => ({ ...f, mode: e.target.value }))} data-testid="pv-b3-mode">
                <option value="">{M.b3ModeNone}</option>
                {B3_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className={BTN} onClick={() => runB3(b3c)} disabled={busy} data-testid="pv-b3-run">{M.b3Run}</button>
          {b3 && <B3Result v={b3} onConfirm={confirmB3} busy={busy} />}
        </Card>
      </div>
    </div>
  );
}
