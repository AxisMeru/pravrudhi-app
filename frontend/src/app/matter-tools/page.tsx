"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { PreviewBadge } from "@/components/PreviewBadge";
import { CaseCheck } from "@/components/preview/CaseCheck";
import { PREVIEW_CASE as CC } from "@/lib/previewCaseCopy";
import { PREVIEW_HEARING as HP } from "@/lib/previewHearingCopy";
import { A1Result, HearingResult, A3Result, A5Result, B3Result, S1Result } from "@/components/preview/Viewers";
import { BailCard, SynopsisCard } from "@/components/preview/Drafting";
import { toolsOffLineShown } from "@/lib/workflowRegistry";
import { useEngineWorkflows } from "@/lib/useEngineWorkflows";
import { PREVIEW } from "@/lib/previewWorkflows";
import { PREVIEW_PAGE as T } from "@/lib/previewPageCopy";
import { MATTER_NOTE } from "@/lib/previewMatterNote";
import { SAMPLE_PAPERS, SAMPLE_TEXT } from "@/lib/sampleMatter";
import { B3_MODES, PREVIEW_MORE as M } from "@/lib/previewMoreCopy";
import { parseA1, parseA3, parseA5, parseB3, parseHearing, parseS1, type HearingView, type A1View, type A3View, type A5View, type B3View, type S1View } from "@/lib/previewParsers";
import { SectionLookup } from "@/components/preview/SectionLookup";
import { SECTION_LOOKUP } from "@/lib/sectionLookup";
import { DRAFTING_CARDS } from "@/lib/draftingCards";
import { previewRefusal } from "@/lib/previewRefusal";
import { useSignedOut } from "@/components/citations/useSignedOut";
import { matterIdOf, parseAgenda, parsePapers, previewPost, type PaperRow } from "@/lib/previewApi";
import { ScannedPaperControl } from "@/components/preview/ScannedPaperControl";
import { SCANNED_INTAKE, keptByName } from "@/lib/scannedIntake";
import { YOUR_MATTERS } from "@/lib/yourMatters";
import { YourMatters } from "@/components/preview/YourMatters";
import { KeptUploads } from "@/components/preview/ScanKept";

const BTN = "inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
const FIELD = "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]";
const BOX = "space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
type Answer = Record<string, unknown> | null;

/** Why a preview call did not give a result, in R1's lines (previewWorkflows.ts); the engine's own `detail` sentence is used when it sent one for a busy or failed call. */
const refusal = previewRefusal;

function Card({ id, name, line, children }: { id: string; name: string; line: string; children: React.ReactNode }) {
  return (
    <section className={BOX} id={`pv-${id}`} aria-labelledby={`pv-${id}-heading`} data-testid={`pv-${id}`}>
      <h2 id={`pv-${id}-heading`} className="flex flex-wrap items-center gap-2 text-base font-medium text-[var(--color-text)]">{name} <PreviewBadge /></h2>
      <p className="text-sm text-[var(--color-text)]">{line}</p>
      {children}
    </section>
  );
}

const GONE_LINE = MATTER_NOTE.matter_gone;

const B3_FIELDS: [string, string][] = [["cheque", M.b3Cheque], ["presentation", M.b3Presentation], ["memo", M.b3Memo], ["information", M.b3Information], ["notice", M.b3Notice], ["receipt", M.b3Receipt]];

export default function PreviewPage() {
  const engineWorkflows = useEngineWorkflows();
  const signedOut = useSignedOut(true); // R1: a signed-out visitor is told to sign in and is offered no button that is certain to refuse
  const [matter, setMatter] = useState<string | null>(null);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [kept] = useState(() => new Map<string, File>()); // flag-ON only: the user's own uploads by the engine's doc_id, kept in this browser so a crop can be drawn from them; cleared when the matter changes
  const [pagesNote, setPagesNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listShown, setListShown] = useState(false); // the matters list is on screen (it hides when the route is off or the read is refused)
  const [message, setMessage] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<{ key: string; lines: string[] }[] | null>(null);
  const [a5, setA5] = useState<A5View | null>(null);
  const [a3, setA3] = useState<A3View | null>(null);
  const [s1, setS1] = useState<S1View | null>(null);
  const [a1, setA1] = useState<A1View | null>(null);
  const [draft, setDraft] = useState("");
  const [hp, setHp] = useState<HearingView | null>(null);
  const [hpDate, setHpDate] = useState("");
  const [b3, setB3] = useState<B3View | null>(null);
  const [b3f, setB3f] = useState<Record<string, string>>({ cheque: "", presentation: "", memo: "", information: "", notice: "", receipt: "", validity: "", mode: "" });

  async function refresh(m: string) {
    const a = await previewPost("/matter-spans/list", { matter_id: m });
    if (a.status === 200) { const p = parsePapers(a.body); setPapers(p.papers); setPagesNote(p.pagesNote); }
    else if (a.status === 404) { kept.clear(); setMatter(null); setPapers([]); setMessage(GONE_LINE); }
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
    kept.clear(); setMatter(id); setPapers([]); clearResults(); setMessage(T.matterStarted);
  });
  /** One click: a new matter and the four invented sample papers (Track A's bundle), added one by one through the same routes a visitor's own papers use. A refusal on any paper stops there and says why. */
  const loadSample = () => run(async () => {
    const a = await previewPost("/matter-spans/matters", {});
    const id = matterIdOf(a.body);
    if (a.status !== 200 || !id) return setMessage(refusal(a.status, a.body));
    kept.clear(); setMatter(id); setPapers([]); clearResults();
    for (const p of SAMPLE_PAPERS) {
      const d = await previewPost("/matter-spans/documents", { matter_id: id, text: p.text, name: p.name });
      if (d.status !== 200) { await refresh(id); return setMessage(refusal(d.status, d.body)); }
    }
    await refresh(id); setMessage(T.matterStarted);
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
    kept.delete(docId);
    await refresh(matter);
  });
  const removeAll = () => run(async () => {
    if (!matter) return;
    const a = await previewPost("/matter-spans/delete", { matter_id: matter });
    if (a.status !== 200) return setMessage(refusal(a.status, a.body));
    kept.clear(); setMatter(null); setPapers([]); clearResults();
  });
  /** A 404 on a matter workflow can mean the store no longer holds the matter (a restart): check with the list route and, if it is gone, start over and say so. */
  const matterGone = async (m: string): Promise<boolean> => {
    const l = await previewPost("/matter-spans/list", { matter_id: m });
    if (l.status !== 404) return false;
    kept.clear(); setMatter(null); setPapers([]); clearResults(); setMessage(GONE_LINE);
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
    <KeptUploads.Provider value={keptByName(papers, kept)}>
    <div>
      <PageHeader title={T.title} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8" data-testid="matter-tools-page">
        <PreviewBadge line />
        {toolsOffLineShown(engineWorkflows, DRAFTING_CARDS) && <p className="text-xs text-[var(--color-text-dim)]" data-testid="pv-tools-off-line">{T.toolsOffLine}</p>}
        {signedOut && (
          <p className="text-sm text-[var(--color-text)]" data-testid="pv-signed-out">{T.signedOutLine} <Link href="/signin" className="inline-flex min-h-6 items-center text-[var(--color-accent)] underline" data-testid="pv-signin-link">{T.signedOutLink}</Link></p>
        )}
        {YOUR_MATTERS && !signedOut && (
          <YourMatters
            current={matter}
            onShown={setListShown}
            onOpen={(id) => { kept.clear(); setMatter(id); setPapers([]); clearResults(); setMessage(null); void refresh(id); }}
            onDeleted={(id) => { if (id === matter) { kept.clear(); setMatter(null); setPapers([]); clearResults(); } }}
          />
        )}
        <section className={BOX} id="pv-matter" aria-labelledby="pv-matter-heading" data-testid="pv-matter">
          <h2 id="pv-matter-heading" className="text-base font-medium text-[var(--color-text)]">{T.matterHeading}</h2>
          {!matter ? (
            signedOut ? null : (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={BTN} onClick={start} disabled={busy} data-testid="pv-start">{T.startMatter}</button>
                <button type="button" className={BTN} onClick={loadSample} disabled={busy} data-testid="pv-sample">{SAMPLE_TEXT.button}</button>
              </div>
            )
          ) : (
            <>
              <label className="block text-sm text-[var(--color-text)]">{T.paperNameLabel}
                <input className={FIELD} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} data-testid="pv-name" />
              </label>
              <label className="block text-sm text-[var(--color-text)]">{T.paperTextLabel}
                <textarea className={`${FIELD} min-h-32`} value={text} onChange={(e) => setText(e.target.value)} data-testid="pv-text" />
              </label>
              <button type="button" className={BTN} onClick={addPaper} disabled={busy || !text.trim()} data-testid="pv-add">{T.addPaper}</button>
              {SCANNED_INTAKE && <ScannedPaperControl matter={matter} busy={busy} onAdded={() => refresh(matter)} onKept={(docId, f) => { kept.set(docId, f); }} onRefusal={(st, body) => setMessage(refusal(st, body))} />}
              {papers.length > 0 && (
                <div data-testid="pv-papers">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">{T.papersHeading}</h3>
                  <ul className="mt-1 space-y-1 text-sm text-[var(--color-text)]">
                    {papers.map((p) => (
                      <li key={p.docId} className="flex items-center justify-between gap-2">
                        <span className="break-words">{p.name}{p.scan?.fromOcr && p.scan.marker && <span className="block text-xs text-[var(--color-text-dim)]" data-testid="scan-ocr-marker">{p.scan.marker}</span>}</span>
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
          {!matter && !signedOut && <p className="text-xs text-[var(--color-text-dim)]" data-testid="pv-sample-note">{SAMPLE_TEXT.note}</p>}
          <p className="text-xs text-[var(--color-text-dim)]" data-testid="pv-matter-note">{(() => { const base = YOUR_MATTERS && listShown ? MATTER_NOTE.matter_note_list : MATTER_NOTE.matter_note; return SCANNED_INTAKE ? base.replace(" Images are not read.", ` ${MATTER_NOTE.matter_note_images}`) : base; })()}</p>
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

        <Card id="cc" name={CC.name} line={CC.line}>
          <CaseCheck matter={matter} />
        </Card>

        <Card id="hp" name={HP.name} line={HP.line}>
          <label className="block text-sm text-[var(--color-text)]">{HP.dateLabel}
            <input className={FIELD} value={hpDate} maxLength={10} placeholder="2026-11-03" onChange={(e) => setHpDate(e.target.value)} data-testid="pv-hp-date" />
          </label>
          <button type="button" className={BTN} onClick={() => runOnMatter("/matter-hearing-pack", parseHearing, setHp, /^\d{4}-\d{2}-\d{2}$/.test(hpDate.trim()) ? { hearing_date: hpDate.trim() } : {})} disabled={busy || !matter} data-testid="pv-hp-run">{HP.run}</button>
          {hp && <HearingResult v={hp} />}
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

        {SECTION_LOOKUP && !signedOut && <SectionLookup />}
        {DRAFTING_CARDS && <BailCard />}
        {DRAFTING_CARDS && <SynopsisCard matter={matter} hasPapers={papers.length > 0} onGone={() => { kept.clear(); setMatter(null); setPapers([]); setMessage(GONE_LINE); }} />}
      </div>
    </div>
    </KeptUploads.Provider>
  );
}
