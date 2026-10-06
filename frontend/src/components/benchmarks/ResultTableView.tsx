import { chartAlt, pairNames, type BoundResult, type PairedResult, type ResultTable } from "@/lib/benchmarks";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/**
 * One result table: an interval chart (point and exact 95% interval on one shared 0 to 100% axis, chance level dashed, rows in the
 * order given, never sorted by value) and, below it, the same figures as a table that is also the chart's text alternative.
 */
export function ResultTableView({ table }: { table: ResultTable }) {
  const rowH = 26;
  const left = 150;
  const width = 560;
  const plot = width - left - 16;
  const height = table.rows.length * rowH + 28;
  const x = (v: number) => left + v * plot;
  return (
    <div className="space-y-2" data-testid="result-table">
      <h4 className="text-sm font-medium text-[var(--color-text)]">{table.title}</h4>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[420px] max-w-[640px]"
          role="img"
          aria-label={chartAlt(table)}
          data-testid="interval-chart"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={4} y2={height - 20} stroke="var(--color-border)" strokeWidth={1} />
              <text x={x(t)} y={height - 6} fontSize={10} textAnchor="middle" fill="var(--color-text-dim)">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {table.chance !== undefined && (
            <line x1={x(table.chance)} x2={x(table.chance)} y1={4} y2={height - 20} stroke="var(--color-text-dim)" strokeWidth={1.5} strokeDasharray="4 3" data-testid="chance-line" />
          )}
          {table.rows.map((r, i) => {
            const y = 14 + i * rowH;
            return (
              <g key={`${r.arm}-${r.group}-${i}`}>
                <text x={left - 8} y={y + 4} fontSize={11} textAnchor="end" fill="var(--color-text)">
                  {r.arm} · {r.group}
                </text>
                <line x1={x(r.ci95[0])} x2={x(r.ci95[1])} y1={y} y2={y} stroke="var(--color-accent)" strokeWidth={2} />
                <line x1={x(r.ci95[0])} x2={x(r.ci95[0])} y1={y - 4} y2={y + 4} stroke="var(--color-accent)" strokeWidth={2} />
                <line x1={x(r.ci95[1])} x2={x(r.ci95[1])} y1={y - 4} y2={y + 4} stroke="var(--color-accent)" strokeWidth={2} />
                <circle cx={x(r.accuracy)} cy={y} r={4} fill="var(--color-accent)" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-xs" data-testid="result-table-values">
          <thead>
            <tr className="text-[var(--color-text-dim)]">
              <th className="pb-1 pr-3 font-medium">arm</th>
              <th className="pb-1 pr-3 font-medium">group</th>
              <th className="pb-1 pr-3 font-medium">n</th>
              <th className="pb-1 pr-3 font-medium">correct</th>
              <th className="pb-1 pr-3 font-medium">accuracy (95% interval)</th>
              <th className="pb-1 font-medium">invalid</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={`${r.arm}-${r.group}-${i}`} className="border-t border-[var(--color-border)]">
                <td className="py-1 pr-3 text-[var(--color-text)]">{r.arm}</td>
                <td className="py-1 pr-3">{r.group}</td>
                <td className="py-1 pr-3">{r.n}</td>
                <td className="py-1 pr-3">{r.correct}</td>
                <td className="py-1 pr-3">
                  {pct(r.accuracy)} ({pct(r.ci95[0])} to {pct(r.ci95[1])})
                </td>
                <td className="py-1">{r.invalid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.chance !== undefined && <p className="text-[11px] text-[var(--color-text-dim)]">Dashed line: chance level, {pct(table.chance)}.</p>}
    </div>
  );
}

/** A paired comparison: how many questions only one arm got right, the label, and the p value in small text (the sentence is read from the data). */
export function PairedView({ pair }: { pair: PairedResult }) {
  const [first, second] = pairNames(pair.pair);
  return (
    <div className="rounded-md border border-[var(--color-border)] p-3 text-sm" data-testid="paired">
      <div className="font-medium text-[var(--color-text)]">{pair.pair}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="text-lg text-[var(--color-text)]">{pair.only_first_correct}</div>
          <div className="text-[11px] text-[var(--color-text-dim)]">only {first} right</div>
        </div>
        <div>
          <div className="text-lg text-[var(--color-text)]">{pair.only_second_correct}</div>
          <div className="text-[11px] text-[var(--color-text-dim)]">only {second} right</div>
        </div>
      </div>
      <div className="mt-2 text-center text-sm text-[var(--color-text)]" data-testid="paired-label">
        {pair.label}
      </div>
      <div className="text-center text-[11px] text-[var(--color-text-dim)]">
        exact McNemar p = {pair.p.toPrecision(3)}
        {pair.holm_adjusted_p != null ? `; Holm-adjusted p = ${pair.holm_adjusted_p.toPrecision(3)}` : ""}
      </div>
      {pair.label_note && <div className="mt-1 text-center text-[11px] text-[var(--color-text-dim)]">{pair.label_note}</div>}
    </div>
  );
}

/** One proportion with its bound: a bar to the value, capped by a mark at the value for an upper bound (the bound IS the figure). */
export function BoundBar({ bound }: { bound: BoundResult }) {
  const v = Math.min(1, Math.max(0, bound.value));
  return (
    <div className="space-y-1" data-testid="bound-bar">
      <div className="text-sm text-[var(--color-text)]">{bound.name}</div>
      <div className="relative h-3 w-full rounded bg-[var(--color-border)]" role="img" aria-label={`${bound.name}: ${pct(bound.value)}, n ${bound.n}, ${bound.kind.replace(/_/g, " ")}`}>
        <div className="absolute inset-y-0 left-0 rounded bg-[var(--color-accent)]" style={{ width: `${v * 100}%` }} />
        <div className="absolute inset-y-[-3px] w-[2px] bg-[var(--color-text)]" style={{ left: `${v * 100}%` }} />
      </div>
    </div>
  );
}
