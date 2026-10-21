"use client";

import { useState } from "react";

import { RowCrop } from "./RowCrop";
import { previewRefusal } from "@/lib/previewRefusal";
import { PreviewBadge } from "@/components/PreviewBadge";
import { DRAFTING_DRAFT as D, DRAFTING_R1 as R, GROUND_LABELS, TAG_LABELS } from "@/lib/previewDraftingCopy";
import { DECLARATION_TEXT, SENSITIVE_DECLARATION, isDeclarationRefusal, showDeclarationMissing, withDeclaration, type Declaration } from "@/lib/sensitiveDeclaration";
import { GROUNDS, TAGS, bailBody, parseBail, parseSynopsis, synopsisBody, type BailView, type FactIn, type SynopsisView } from "@/lib/previewDraftingParsers";
import { previewPost } from "@/lib/previewApi";
import { PREVIEW } from "@/lib/previewWorkflows";

const BTN = "inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
const FIELD = "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]";
const BOX = "space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const P = "text-sm text-[var(--color-text)]";
const H = "text-sm font-medium text-[var(--color-text)]";
const emptyFact = (): FactIn => ({ text: "", applicant: false, grounds: [] });

/** Why a drafting call gave no draft: the engine's own sentence where it sent one, else R1's lines (previewWorkflows.ts). */
const refusal = previewRefusal;

function Box({ id, name, line, children }: { id: string; name: string; line: string; children: React.ReactNode }) {
  return (
    <section className={BOX} aria-labelledby={`pv-${id}-heading`} data-testid={`pv-${id}`}>
      <h2 id={`pv-${id}-heading`} className="flex flex-wrap items-center gap-2 text-base font-medium text-[var(--color-text)]">{name} <PreviewBadge /></h2>
      <p className={P}>{line}</p>
      {children}
    </section>
  );
}

function FactsEditor({ id, rows, setRows, warning, withGrounds }: { id: string; rows: FactIn[]; setRows: (r: FactIn[]) => void; warning: string; withGrounds: boolean }) {
  const set = (i: number, patch: Partial<FactIn>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <fieldset className="space-y-2">
      <legend className={H}>{D.factsHeading}</legend>
      <p className="text-sm text-[var(--color-warn)]" data-testid={`${id}-tick-warning`}>{warning}</p>
      {rows.map((r, i) => (
        <div key={i} className="space-y-1 rounded-md border border-[var(--color-border)] p-2" data-testid={`${id}-fact`}>
          <label className={`block ${P}`}>{D.factText} {i + 1}
            <textarea className={`${FIELD} mt-1`} rows={2} maxLength={1500} value={r.text} onChange={(e) => set(i, { text: e.target.value })} />
          </label>
          <label className={`flex items-center gap-2 ${P}`}>
            <input type="checkbox" checked={r.applicant} onChange={(e) => set(i, { applicant: e.target.checked })} /> {D.factApplicant}
          </label>
          {withGrounds && r.applicant && (
            <details>
              <summary className={`cursor-pointer ${P}`}>{D.groundsHeading}</summary>
              <div className="mt-1 flex flex-wrap gap-3">
                {GROUNDS.map((g) => (
                  <label key={g} className={`flex items-center gap-1 ${P}`}>
                    <input type="checkbox" checked={r.grounds.includes(g)} onChange={(e) => set(i, { grounds: e.target.checked ? [...r.grounds, g] : r.grounds.filter((x) => x !== g) })} /> {GROUND_LABELS[g]}
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
      <button type="button" className={BTN} onClick={() => setRows([...rows, emptyFact()])}>{D.addFact}</button>
    </fieldset>
  );
}

function Notes({ notes, more, fillIns }: { notes: string[]; more: string[]; fillIns: string[] }) {
  return (
    <>
      {notes.length > 0 && <div><h4 className={H}>{R.notesHeading}</h4><ul className={`mt-1 list-disc space-y-1 pl-5 ${P}`}>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
      {fillIns.length > 0 && <div><h4 className={H}>{R.fillInsHeading}</h4><ul className={`mt-1 list-disc space-y-1 pl-5 ${P}`}>{fillIns.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
      {more.length > 0 && <details data-testid="more-notes"><summary className={`cursor-pointer ${H}`}>{R.moreNotesHeading}</summary><ul className={`mt-1 list-disc space-y-1 pl-5 ${P}`}>{more.map((n, i) => <li key={i}>{n}</li>)}</ul></details>}
    </>
  );
}

function Label({ label }: { label: string | null }) {
  return label ? <p className="text-sm font-medium text-[var(--color-warn)]" data-testid="draft-label">{label}</p> : null;
}

function BailResult({ v }: { v: BailView }) {
  return (
    <div className="space-y-3" data-testid="bail-result">
      <Label label={v.label} />
      {v.referral && <p className={P} data-testid="bail-referral">{v.referral.text}</p>}
      {v.framing && (
        <div data-testid="bail-framing">
          {v.framing.lines.map((l, i) => <p key={i} className={P}>{l}</p>)}
          {v.framing.unconfirmed && <p className={P} data-testid="bail-unconfirmed">{v.framing.unconfirmed}</p>}
        </div>
      )}
      {v.state === "template_only" && <p className={P}>{R.templateOnly}</p>}
      {v.text && <pre className="whitespace-pre-wrap rounded-md border border-[var(--color-border)] p-3 text-sm text-[var(--color-text)]" data-testid="bail-text">{v.text}</pre>}
      <Notes notes={v.notes} more={v.moreNotes} fillIns={v.fillIns} />
      {v.factsSetAside ? <p className={P}>{D.factsSetAside} {v.factsSetAside}</p> : null}
    </div>
  );
}

/** R1's required question (no default): the legend names the three things once and the two choices answer it. Starts empty every time. */
function DeclarationChoice({ id, value, onChange }: { id: string; value: Declaration; onChange: (v: Declaration) => void }) {
  return (
    <fieldset className="space-y-1" data-testid={`${id}-declaration`}>
      <legend className={P}>{DECLARATION_TEXT.legend}</legend>
      <label className={`flex items-start gap-2 ${P}`}><input type="radio" name={`${id}-declaration`} className="mt-1" checked={value === "none"} onChange={() => onChange("none")} data-testid={`${id}-declaration-none`} /> {DECLARATION_TEXT.none}</label>
      <label className={`flex items-start gap-2 ${P}`}><input type="radio" name={`${id}-declaration`} className="mt-1" checked={value === "sensitive"} onChange={() => onChange("sensitive")} data-testid={`${id}-declaration-sensitive`} /> {DECLARATION_TEXT.sensitive}</label>
    </fieldset>
  );
}

export function BailCard({ prefill = null, prefillLine }: { prefill?: { key: number; facts: { text: string; applicant: boolean }[] } | null; prefillLine?: string }) {
  const [consent, setConsent] = useState(false);
  const [kind, setKind] = useState<"bail" | "anticipatory_bail">("bail");
  const [forum, setForum] = useState<"trial_court" | "sessions_or_high_court" | "">("");
  const [offence, setOffence] = useState("");
  const [fir, setFir] = useState("");
  const [facts, setFacts] = useState<FactIn[]>([emptyFact()]);
  // a loaded sample matter's five invented facts, with their sides (R1: one line says who filled them); applied once per load, then they are the visitor's to edit
  const [filled, setFilled] = useState(false);
  const [appliedKey, setAppliedKey] = useState<number | null>(null);
  if (prefill && appliedKey !== prefill.key) { setAppliedKey(prefill.key); setFacts(prefill.facts.map((f) => ({ ...emptyFact(), text: f.text, applicant: f.applicant }))); setFilled(true); }
  if (!prefill && appliedKey !== null) { setAppliedKey(null); setFilled(false); setFacts([emptyFact()]); }
  const [tags, setTags] = useState<string[]>([]);
  const [sections, setSections] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<BailView | null>(null);
  const [declared, setDeclared] = useState<Declaration>(""); // flag ON: no choice made, every time
  const baseBody = bailBody({ consent, kind, forum, offence, fir, facts, tags, sections });
  const body = withDeclaration(baseBody, declared);

  async function go() {
    if (!body) return;
    setBusy(true); setMessage(null); setView(null);
    try {
      const a = await previewPost("/bail-draft", body);
      if (isDeclarationRefusal(a.status, a.body)) return setMessage(DECLARATION_TEXT.missing);
      if (a.status !== 200) return setMessage(refusal(a.status, a.body));
      const v = parseBail(a.body);
      if (!v) return setMessage(PREVIEW.wf_error);
      setView(v);
    } catch { setMessage(PREVIEW.wf_error); } finally { setBusy(false); setDeclared(""); }
  }
  return (
    <Box id="bail" name={D.bailName} line={D.bailLine}>
      {filled && prefillLine && <p className="text-xs text-[var(--color-text-dim)]" data-testid="pv-prefill-line-bail">{prefillLine}</p>}
      <label className={`flex items-start gap-2 ${P}`}><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="bail-consent" /> {D.consent}</label>
      <div className="flex flex-wrap gap-3">
        <label className={P}>{D.kind}
          <select className={`${FIELD} mt-1`} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="bail">{D.kindBail}</option><option value="anticipatory_bail">{D.kindAnticipatory}</option>
          </select>
        </label>
        {kind === "bail" && (
          <label className={P}>{D.forum}
            <select className={`${FIELD} mt-1`} value={forum} onChange={(e) => setForum(e.target.value as typeof forum)} data-testid="bail-forum">
              <option value=""></option><option value="trial_court">{D.forumTrial}</option><option value="sessions_or_high_court">{D.forumSessions}</option>
            </select>
          </label>
        )}
        <label className={P}>{D.offenceDate}<input type="date" className={`${FIELD} mt-1`} value={offence} onChange={(e) => setOffence(e.target.value)} data-testid="bail-offence" /></label>
        <label className={P}>{D.firDate}<input type="date" className={`${FIELD} mt-1`} value={fir} onChange={(e) => setFir(e.target.value)} data-testid="bail-fir" /></label>
      </div>
      <FactsEditor id="bail" rows={facts} setRows={setFacts} warning={R.bailTickWarning} withGrounds />
      <fieldset>
        <legend className={H}>{D.tagsHeading}</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {TAGS.map((t) => (
            <label key={t} className={`flex items-center gap-1 ${P}`}><input type="checkbox" checked={tags.includes(t)} onChange={(e) => setTags(e.target.checked ? [...tags, t] : tags.filter((x) => x !== t))} /> {TAG_LABELS[t]}</label>
          ))}
        </div>
      </fieldset>
      <label className={`block ${P}`}>{D.sections}<input className={`${FIELD} mt-1`} value={sections} onChange={(e) => setSections(e.target.value)} /></label>
      {SENSITIVE_DECLARATION && <DeclarationChoice id="bail" value={declared} onChange={setDeclared} />}
      {showDeclarationMissing(SENSITIVE_DECLARATION, declared, baseBody !== null) && <p className={P} data-testid="bail-declaration-missing">{DECLARATION_TEXT.missing}</p>}
      <button type="button" className={BTN} disabled={busy || !body} onClick={go} data-testid="bail-run">{D.runBail}</button>
      {message && <p role="status" className={P} data-testid="bail-message">{message}</p>}
      {view && <BailResult v={view} />}
    </Box>
  );
}

function SynopsisResult({ v, kept, setKept, onUpdate, busy, updateBlocked }: { v: SynopsisView; kept: number[]; setKept: (k: number[]) => void; onUpdate: () => void; busy: boolean; updateBlocked: boolean }) {
  const d = v.dates;
  return (
    <div className="space-y-3" data-testid="synopsis-result">
      <Label label={v.label} />
      {v.referral && <p className={P} data-testid="synopsis-referral">{v.referral.text}</p>}
      {d && (
        <div className="space-y-2" data-testid="dates-table">
          {d.heading && <h4 className={H}>{d.heading}</h4>}
          {v.datesNote && <p className={P}>{v.datesNote}</p>}
          {d.rows.length === 0 && d.noneLine && <p className={P}>{d.noneLine}</p>}
          {d.rows.length > 0 && (
            <table className="w-full text-left text-sm text-[var(--color-text)]">
              <thead><tr><th scope="col"><span className="sr-only">{D.keepRows}</span></th>{d.columns.map((c) => <th key={c} scope="col" className="pr-2">{c}</th>)}</tr></thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={i} className="align-top" data-testid="dates-row">
                    <td className="pr-2">{r.rowId !== null && <input type="checkbox" aria-label={D.keepRows} checked={kept.includes(r.rowId)} onChange={(e) => setKept(e.target.checked ? [...kept, r.rowId!] : kept.filter((x) => x !== r.rowId))} />}</td>
                    <td className="pr-2">{r.dateAsWritten}{r.dates.filter((d) => d.ambiguous && d.readings.length > 0).map((d, j) => <span key={j} className="block text-xs text-[var(--color-text-dim)]" data-testid="dates-readings">{r.dates.length > 1 ? `${d.written}: ` : ""}{d.readings.join(" / ")}</span>)}</td>
                    <td className="pr-2">{r.eventLine && <span className="block">{r.eventLine}</span>}{r.eventQuote && <span className="block">{r.eventQuote}</span>}<RowCrop scan={r.scan} /></td>
                    <td>{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {d.cutLine && <p className={P}>{d.cutLine}</p>}
          {d.rows.length > 0 && <button type="button" className={BTN} disabled={busy || updateBlocked} onClick={onUpdate} data-testid="synopsis-update">{D.updateRows}</button>}
        </div>
      )}
      {v.synopsis && (
        <div data-testid="synopsis-text">
          {v.synopsis.heading && <h4 className={H}>{v.synopsis.heading}</h4>}
          {v.synopsis.paragraphs.map((p, i) => <p key={i} className={`mt-1 ${P}`}>{p}</p>)}
          {v.synopsis.paragraphs.length === 0 && v.synopsis.fallback && <p className={P}>{v.synopsis.fallback}</p>}
        </div>
      )}
      <Notes notes={v.notes} more={v.moreNotes} fillIns={v.fillIns} />
      {v.factsSetAside ? <p className={P}>{D.factsSetAside} {v.factsSetAside}</p> : null}
    </div>
  );
}

export function SynopsisCard({ matter, hasPapers, onGone }: { matter: string | null; hasPapers: boolean; onGone: () => void }) {
  const [consent, setConsent] = useState(false);
  const [declared, setDeclared] = useState<Declaration>(""); // flag ON: no choice made, every time
  const [facts, setFacts] = useState<FactIn[]>([emptyFact()]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<SynopsisView | null>(null);
  const [kept, setKept] = useState<number[]>([]);

  async function go(keep: number[] | null) {
    const body = matter ? withDeclaration(synopsisBody(matter, consent, facts, label, keep), declared) : null;
    if (!body) return;
    setBusy(true); setMessage(null);
    try {
      const a = await previewPost("/synopsis-dates", body);
      if (isDeclarationRefusal(a.status, a.body)) { setView(null); return setMessage(DECLARATION_TEXT.missing); }
      if (a.status === 404) { setView(null); onGone(); return setMessage(PREVIEW.wf_unavailable); }
      if (a.status !== 200) { setView(null); return setMessage(refusal(a.status, a.body)); }
      const v = parseSynopsis(a.body);
      if (!v) { setView(null); return setMessage(PREVIEW.wf_error); }
      setView(v);
      if (keep === null) setKept((v.dates?.rows ?? []).flatMap((r) => (r.rowId !== null ? [r.rowId] : [])));
    } catch { setMessage(PREVIEW.wf_error); } finally { setBusy(false); setDeclared(""); }
  }
  return (
    <Box id="synopsis" name={D.synopsisName} line={D.synopsisLine}>
      {!hasPapers && <p className={P}>{D.needMatter}</p>}
      <label className={`flex items-start gap-2 ${P}`}><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="synopsis-consent" /> {D.consentSynopsis}</label>
      <label className={`block ${P}`}>{D.documentLabel}<input className={`${FIELD} mt-1`} maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <FactsEditor id="synopsis" rows={facts} setRows={setFacts} warning={R.synopsisTickWarning} withGrounds={false} />
      {SENSITIVE_DECLARATION && <DeclarationChoice id="synopsis" value={declared} onChange={setDeclared} />}
      {showDeclarationMissing(SENSITIVE_DECLARATION, declared, hasPapers && consent) && <p className={P} data-testid="synopsis-declaration-missing">{DECLARATION_TEXT.missing}</p>}
      <button type="button" className={BTN} disabled={busy || !hasPapers || !consent || (SENSITIVE_DECLARATION && declared === "")} onClick={() => go(null)} data-testid="synopsis-run">{D.runSynopsis}</button>
      {message && <p role="status" className={P} data-testid="synopsis-message">{message}</p>}
      {view && <SynopsisResult v={view} kept={kept} setKept={setKept} onUpdate={() => go(kept)} busy={busy} updateBlocked={SENSITIVE_DECLARATION && declared === ""} />}
    </Box>
  );
}
