"use client";

import { useState } from "react";

import { RowCrop } from "./RowCrop";
import { previewRefusal } from "@/lib/previewRefusal";
import { A5Result, B3Result } from "@/components/preview/Viewers";
import { B3_MODES, PREVIEW_MORE as M } from "@/lib/previewMoreCopy";
import { PREVIEW_CASE as C } from "@/lib/previewCaseCopy";
import { PREVIEW } from "@/lib/previewWorkflows";
import { previewPost } from "@/lib/previewApi";
import { CASE_ROLES, caseB3Body, parseCaseCheck, type CaseCandidate, type CaseCheckView } from "@/lib/previewParsers";

const BTN = "inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
const FIELD = "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]";
type Role = (typeof CASE_ROLES)[number];
type Pick = { c: CaseCandidate; reading: string | null };

const refusal = previewRefusal;

/** One screen for a cheque case: A5's agenda, the candidate dates per step from the papers, the user's pick and confirmation per step, then B3's checklist beside the agenda. Nothing is picked for the user. */
export function CaseCheck({ matter, matterGone }: { matter: string | null; matterGone?: () => Promise<boolean> }) {
  const [view, setView] = useState<CaseCheckView | null>(null);
  const [picks, setPicks] = useState<Partial<Record<Role, Pick>>>({});
  const [validity, setValidity] = useState("");
  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const call = async (extra: Record<string, unknown>): Promise<CaseCheckView | null> => {
    setBusy(true); setMessage(null);
    try {
      const a = await previewPost("/cheque-case-check", { matter_id: matter, ...extra });
      if (a.status === 404 && matterGone && (await matterGone())) return null; // the matter is gone: the page says so and starts over; only then is a 404 the route being off (R1 21 Oct)
      if (a.status !== 200) { setMessage(refusal(a.status, a.body, "/cheque-case-check")); return null; }
      const v = parseCaseCheck(a.body);
      if (!v) { setMessage(PREVIEW.wf_error); return null; }
      return v;
    } catch { setMessage(PREVIEW.wf_error); return null; } finally { setBusy(false); }
  };
  const find = async () => { if (!matter) return; const v = await call({}); if (v) { setView(v); setPicks({}); } };
  const make = async () => {
    const months = Number(validity);
    const b3 = caseB3Body(picks, { validityMonths: validity.trim() && Number.isInteger(months) && months >= 1 && months <= 60 ? months : undefined, noticeMode: mode || undefined });
    if (!b3) return;
    const v = await call({ b3 });
    if (v) setView(v);
  };
  const choose = (role: Role, c: CaseCandidate | null) => setPicks((p) => { const n = { ...p }; if (c) n[role] = { c, reading: null }; else delete n[role]; return n; });
  const readyToMake = Object.values(picks).some((p) => p && (!p.c.ambiguous || p.reading)) && Object.values(picks).every((p) => !p || !p.c.ambiguous || p.reading);

  return (
    <div className="space-y-3" data-testid="pv-cc-body">
      <button type="button" className={BTN} onClick={find} disabled={busy || !matter} data-testid="pv-cc-run">{C.run}</button>
      {message && <p role="status" className="text-sm text-[var(--color-text)]" data-testid="pv-cc-message">{message}</p>}
      {view && (
        <div className="space-y-4" data-testid="pv-cc-result">
          {view.statement && <p className="text-sm text-[var(--color-text)]">{view.statement}</p>}
          {view.agenda && <A5Result v={view.agenda} />}
          {view.roles.map((r) => (
            <fieldset key={r.role} className="space-y-1" data-testid={`pv-cc-role-${r.role}`}>
              <legend className="text-sm font-medium text-[var(--color-text)]">{r.label}: {C.pickLegend}</legend>
              {r.candidates.map((c) => (
                <div key={c.id} className="text-sm text-[var(--color-text)]">
                  <label className="flex min-h-[44px] items-start gap-2">
                    <input type="radio" name={`cc-${r.role}`} checked={picks[r.role]?.c.id === c.id} onChange={() => choose(r.role, c)} data-testid={`pv-cc-pick-${c.id}`} />
                    <span><span className="font-medium">{c.value}</span>{c.source && <span className="text-[var(--color-text-dim)]"> · {c.source}</span>}{c.quote && <q className="block text-xs text-[var(--color-text-dim)]">{c.quote}</q>}<RowCrop scan={c.scan} /></span>
                  </label>
                  {c.ambiguous && picks[r.role]?.c.id === c.id && (
                    <div className="ml-6" data-testid={`pv-cc-readings-${c.id}`}>
                      <p className="text-xs text-[var(--color-text-dim)]">{C.readingLegend}</p>
                      {c.readings.map((d) => (
                        <label key={d} className="flex min-h-[44px] items-center gap-2 text-sm">
                          <input type="radio" name={`cc-reading-${c.id}`} checked={picks[r.role]?.reading === d} onChange={() => setPicks((p) => ({ ...p, [r.role]: { c, reading: d } }))} />
                          {d}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {r.candidates.length === 0 && r.noCandidate && <p className="text-sm text-[var(--color-text)]">{r.noCandidate}</p>}
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-[var(--color-text)]">
                <input type="radio" name={`cc-${r.role}`} checked={!picks[r.role]} onChange={() => choose(r.role, null)} />{C.pickNone}
              </label>
            </fieldset>
          ))}
          {view.notUsableLine && <p className="text-xs text-[var(--color-text-dim)]">{view.notUsableLine}</p>}
          {view.notUsable.length > 0 && <ul className="list-disc pl-5 text-xs text-[var(--color-text-dim)]">{view.notUsable.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm text-[var(--color-text)]">{M.b3Validity}
              <input className={FIELD} inputMode="numeric" maxLength={2} value={validity} onChange={(e) => setValidity(e.target.value)} data-testid="pv-cc-validity" />
            </label>
            <label className="block text-sm text-[var(--color-text)]">{M.b3Mode}
              <select className={FIELD} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="">{M.b3ModeNone}</option>
                {B3_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          {!view.checklist && view.pending && <p className="text-sm text-[var(--color-text)]">{view.pending}</p>}
          <button type="button" className={BTN} onClick={make} disabled={busy || !readyToMake} data-testid="pv-cc-make">{C.make}</button>
          {view.checklist && <B3Result v={view.checklist} />}
          {view.notAssessed.length > 0 && <ul className="list-disc pl-5 text-sm text-[var(--color-text)]">{view.notAssessed.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
