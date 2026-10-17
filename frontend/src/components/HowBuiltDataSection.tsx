import { DATA_LEAD_INS, DATA_LIMITS, DATA_NOT_PUBLISHED, DATA_NOTE_TEXT as T, DATA_SETS, groupLines } from "@/lib/howItWasBuiltData";

const URL_RE = /(https:\/\/huggingface\.co\/datasets\/AxisMeru\/nyayasiddhi)/;

/** A line with the one public dataset URL it may carry shown as a link; the words are R1's, unchanged. */
function Line({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return <>{parts.map((p, i) => (URL_RE.test(p) && p === parts[i] && i % 2 === 1 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--color-accent)] underline">{p}</a> : p))}</>;
}

/** "More on step 1: the data sets" (app#431): the extension of the first card, placed right after it. R1's words only (lib/howItWasBuiltData.ts), pinned by hash. */
export function HowBuiltDataSection() {
  return (
    <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5" aria-labelledby="how-built-data-heading" data-testid="how-built-data">
      <h2 id="how-built-data-heading" className="text-base font-medium text-[var(--color-text)]">{T.heading}</h2>
      <p className="text-sm text-[var(--color-text)]" data-testid="how-built-data-intro">{T.intro}</p>
      {DATA_SETS.map((s) => (
        <div key={s.id} data-testid={`how-built-data-${s.id}`}>
          <h3 className="text-sm font-medium text-[var(--color-text)]">{T[s.name]}</h3>
          <dl className="mt-1 space-y-1 text-sm text-[var(--color-text-dim)]">
            {groupLines(s.lines).map((g) => (
              <div key={g.keys[0]} className="sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                <dt className="text-xs font-medium text-[var(--color-text)]" data-testid={g.leadIn ? `how-built-leadin-${g.leadIn}` : undefined}>{g.leadIn ? DATA_LEAD_INS[g.leadIn] : null}</dt>
                <dd className="space-y-1">{g.keys.map((k) => <p key={k}><Line text={T[k]} /></p>)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <div data-testid="how-built-data-np">
        <h3 className="text-sm font-medium text-[var(--color-text)]">{T.np_heading}</h3>
        <ul className="mt-1 space-y-1 text-sm text-[var(--color-text-dim)]">{DATA_NOT_PUBLISHED.map((k) => <li key={k}>{T[k]}</li>)}</ul>
      </div>
      <div data-testid="how-built-data-limits">
        <h3 className="text-sm font-medium text-[var(--color-text)]">{T.cv_heading}</h3>
        <ul className="mt-1 space-y-1 text-sm text-[var(--color-text-dim)]">{DATA_LIMITS.map((k) => <li key={k}>{T[k]}</li>)}</ul>
      </div>
    </section>
  );
}
