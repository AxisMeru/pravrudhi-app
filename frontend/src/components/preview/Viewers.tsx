import { statusLabel } from "@/lib/citationCheck";
import { PREVIEW_MORE } from "@/lib/previewMoreCopy";
import { RowCrop } from "./RowCrop";
import type { A1View, A3View, A5View, B3View, CitationRow, HearingRow, HearingView, S1View } from "@/lib/previewParsers";

const P = "text-sm text-[var(--color-text)]";
const DIM = "text-xs text-[var(--color-text-dim)]";
const H = "text-sm font-medium text-[var(--color-text)]";

/** The engine's status token for a citation row, in the app's own signed words where the app has them (lib/citationCheck.ts); "not_checked" and anything unknown read the neutral line. */
export function citationStatusText(status: string): string {
  switch (status) {
    case "found": return statusLabel("IN_INDEX", true);
    case "not_found": return statusLabel("NOT_IN_INDEX", true);
    case "conflict": return statusLabel("CONFLICT", true);
    case "name_mismatch": return statusLabel("NAME_MISMATCH", true);
    default: return PREVIEW_MORE.citation_not_checked;
  }
}

function Lines({ lines, testid }: { lines: string[]; testid?: string }) {
  return <div className="space-y-1" data-testid={testid}>{lines.map((l, i) => <p key={i} className={P}>{l}</p>)}</div>;
}
function List({ heading, items }: { heading?: string | null; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      {heading && <h4 className={H}>{heading}</h4>}
      <ul className={`mt-1 list-disc space-y-1 pl-5 ${P}`}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}
function CitationList({ rows }: { rows: CitationRow[] }) {
  return (
    <ul className="space-y-1" data-testid="pv-citations">
      {rows.map((c, i) => (
        <li key={i} className={`${P} flex flex-wrap gap-x-3`}><span className="break-words font-medium">{c.text}</span><span>{citationStatusText(c.status)}</span><RowCrop scan={c.scan} /></li>
      ))}
    </ul>
  );
}

export function A5Result({ v }: { v: A5View }) {
  return (
    <div className="space-y-3" data-testid="pv-a5-result">
      <Lines lines={v.lines} />
      {v.offence && <h3 className={H}>{v.offence}</h3>}
      {v.ingredients.length > 0 && (
        <div data-testid="pv-a5-ingredients">
          {v.ingredientsHeading && <h4 className={H}>{v.ingredientsHeading}</h4>}
          <ol className={`mt-1 space-y-2 ${P}`}>
            {v.ingredients.map((i, n) => <li key={n}>{i.proviso && <span className="font-medium">{i.proviso} </span>}<q>{i.words}</q></li>)}
          </ol>
        </div>
      )}
      {v.statuteNames.rows.length > 0 && (
        <div data-testid="pv-a5-names">
          {v.statuteNames.heading && <h4 className={H}>{v.statuteNames.heading}</h4>}
          <ul className={`mt-1 space-y-2 ${P}`}>
            {v.statuteNames.rows.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{r.label}</span>{r.tag && <span className={DIM}> · {r.tag}</span>}
                {r.words && <p className={DIM}><q>{r.words}</q></p>}
                {r.status && <p className={P}>{r.status}</p>}
                {r.papers.length > 0 && <p className={P}>{r.papers.join("; ")}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <List heading={v.papersRead.heading} items={v.papersRead.names} />
      <List heading={v.notAdded.heading} items={v.notAdded.rows} />
      {v.notAdded.rows.length === 0 && v.notAdded.noneLine && <p className={P}>{v.notAdded.noneLine}</p>}
      <List items={v.notAssessed} />
    </div>
  );
}

export function A3Result({ v }: { v: A3View }) {
  return (
    <div className="space-y-4" data-testid="pv-a3-result">
      <Lines lines={v.lines} />
      {v.sections.map((s) => (
        <div key={s.key} className="overflow-x-auto" data-testid={`pv-a3-${s.key}`}>
          {s.heading && <h4 className={H}>{s.heading}</h4>}
          <table className="mt-1 w-full min-w-[32rem] text-left text-sm text-[var(--color-text)]">
            <thead>
              <tr className="text-xs text-[var(--color-text-dim)]">
                <th scope="col" className="py-1 pr-3 font-medium">{v.headers.date}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{v.headers.mentions}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{v.headers.sentence}</th>
                <th scope="col" className="py-1 font-medium">{v.headers.source}</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--color-border)] align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.dateAsWritten}</div>
                    {r.howText && <div className={DIM}>{r.howText}</div>}
                    {r.readings.length > 0 && <ul className={DIM} data-testid="pv-a3-readings">{r.readings.map((d) => <li key={d}>{d}</li>)}</ul>}
                    {r.notes.map((n, k) => <div key={k} className={DIM}>{n}</div>)}
                  </td>
                  <td className="py-2 pr-3">{r.mentions}</td>
                  <td className="py-2 pr-3">{r.quote && <q>{r.quote}</q>}<RowCrop scan={r.scan} /></td>
                  <td className="py-2">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <List items={v.papersRead} />
      <List items={v.notAdded} />
    </div>
  );
}

export function S1Result({ v }: { v: S1View }) {
  return (
    <div className="space-y-3" data-testid="pv-s1-result">
      <Lines lines={v.lines} />
      {v.heading && <h3 className={H}>{v.heading}</h3>}
      {v.papers.map((p, i) => (
        <div key={i}><h4 className={H}>{p.name}</h4>{p.citations.length > 0 && <CitationList rows={p.citations} />}</div>
      ))}
      {v.wording && <p className={DIM}>{v.wording}</p>}
      <List items={v.notAssessed} />
    </div>
  );
}

export function A1Result({ v }: { v: A1View }) {
  return (
    <div className="space-y-3" data-testid="pv-a1-result">
      {v.summary && <p className={P}>{v.summary}</p>}
      {v.citations.length > 0 && <CitationList rows={v.citations} />}
      {v.wording && <p className={DIM}>{v.wording}</p>}
      <List items={v.notAssessed} />
    </div>
  );
}

export function B3Result({ v, onConfirm, busy }: { v: B3View; onConfirm?: (input: { role: string; text: string; readAs: string }) => void; busy?: boolean }) {
  return (
    <div className="space-y-3" data-testid="pv-b3-result">
      {v.statement && <p className={`${P} font-medium`}>{v.statement}</p>}
      {v.description && <p className={P}>{v.description}</p>}
      {v.rule && <p className={DIM}>{v.rule}</p>}
      <ul className="space-y-1" data-testid="pv-b3-inputs">
        {v.inputs.map((i, n) => (
          <li key={n} className={`${P} flex flex-wrap items-center gap-x-3 gap-y-1`}>
            <span className="font-medium">{i.role}</span><span>{i.text}</span>
            {i.readAs && <span data-testid="pv-b3-readas">{i.readAs}</span>}
            {onConfirm && i.readAs && !i.confirmed && (
              <button type="button" disabled={busy} className="inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm" onClick={() => onConfirm({ role: i.role, text: i.text, readAs: i.readAs! })} data-testid="pv-b3-confirm">{PREVIEW_MORE.confirm_date.replace("{date}", i.readAs)}</button>
            )}
          </li>
        ))}
      </ul>
      <ol className="space-y-3" data-testid="pv-b3-steps">
        {v.steps.map((s, i) => (
          <li key={i} className="rounded-md border border-[var(--color-border)] p-3">
            <div className={`${P} font-medium`}>{s.clause && `${s.clause} `}{s.title}</div>
            <div className={P} data-testid="pv-b3-status">{s.status}</div>
            {s.result && <p className={P}>{s.result}</p>}
            {s.refer.length > 0 && <ul className={`list-disc pl-5 ${P}`}>{s.refer.map((t, k) => <li key={k}>{t}</li>)}</ul>}
            {s.counts.length > 0 && <ul className={DIM} data-testid="pv-b3-counts">{s.counts.map((c, k) => <li key={k}>{c.convention}{c.periodEnds && `: ${c.periodEnds}`}{c.status && ` (${c.status})`}</li>)}</ul>}
            {s.notes.map((n, k) => <p key={k} className={DIM}>{n}</p>)}
          </li>
        ))}
      </ol>
      <List items={v.notes} />
      <List items={v.notAssessed} />
    </div>
  );
}

function HearingRows({ rows }: { rows: HearingRow[] }) {
  return (
    <ul className="mt-1 space-y-2" data-testid="pv-hp-rows">
      {rows.map((r, i) => (
        <li key={i} className={P}>
          <span className="font-medium">{r.dateAsWritten}</span>
          {r.readings.length > 0 ? <ul className={DIM} data-testid="pv-hp-readings">{r.readings.map((d) => <li key={d}>{d}</li>)}</ul> : r.readAs && <span className={DIM}> · {r.readAs}</span>}
          {r.quote && <q className="block text-xs text-[var(--color-text-dim)]">{r.quote}</q>}
          <RowCrop scan={r.scan} />
          {r.source && <span className={DIM}>{r.source}</span>}
        </li>
      ))}
    </ul>
  );
}

export function HearingResult({ v }: { v: HearingView }) {
  return (
    <div className="space-y-4" data-testid="pv-hp-result">
      {v.statement && <p className={P}>{v.statement}</p>}
      {v.hearingDateGiven && <p className={P} data-testid="pv-hp-given">{v.hearingDateGiven}</p>}
      <div data-testid="pv-hp-next">
        {v.nextDates.heading && <h4 className={H}>{v.nextDates.heading}</h4>}
        {v.nextDates.rows.length > 0 ? <HearingRows rows={v.nextDates.rows} /> : v.nextDates.noneLine && <p className={P}>{v.nextDates.noneLine}</p>}
      </div>
      <div data-testid="pv-hp-timeline">
        {v.timeline.heading && <h4 className={H}>{v.timeline.heading}</h4>}
        <HearingRows rows={v.timeline.rows} />
        {v.timeline.cutLine && <p className={DIM}>{v.timeline.cutLine}</p>}
      </div>
      <List heading={v.notAdded.heading} items={v.notAdded.rows} />
      {v.notAdded.rows.length === 0 && v.notAdded.noneLine && <p className={P}>{v.notAdded.noneLine}</p>}
      <div data-testid="pv-hp-citations">
        {v.citations.heading && <h4 className={H}>{v.citations.heading}</h4>}
        {v.citations.line && <p className={P}>{v.citations.line}</p>}
        {[...v.citations.needsAttention, ...v.citations.notChecked].length > 0 && (
          <ul className="mt-1 space-y-1">
            {[...v.citations.needsAttention, ...v.citations.notChecked].map((c, i) => (
              <li key={i} className={`${P} flex flex-wrap gap-x-3`}><span className="break-words font-medium">{c.text}</span><span>{citationStatusText(c.status)}</span>{c.where.length > 0 && <span className={DIM}>{c.where.join("; ")}</span>}</li>
            ))}
          </ul>
        )}
        {v.citations.sweepSummary && <p className={DIM}>{v.citations.sweepSummary}</p>}
        {v.citations.note && <p className={DIM} data-testid="pv-hp-note">{v.citations.note}</p>}
      </div>
      <List items={v.papers} />
      <List items={v.notAssessed} />
    </div>
  );
}
