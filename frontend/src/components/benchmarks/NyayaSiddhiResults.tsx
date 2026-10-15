"use client";

import { useState } from "react";

import { ALL_GROUP, MEASURES, groupsOf, intervalGeometry, metricOf, pct, unitsOf, zeroWithZero, type Measure, type Metric, type ResultRow, type Unit } from "@/lib/nyayasiddhiRows";
import { resolveStrings, type NyayaSiddhiStrings } from "@/lib/nyayasiddhi";

/** One figure: the count with its n, the exact interval printed, and the interval drawn on a 0 to 1 scale. The numbers are always in the text; the drawing only repeats them. */
export function Figure({ m, measure, s }: { m: Metric | null; measure: Measure; s: NyayaSiddhiStrings }) {
  if (!m) return <p className="text-sm text-[var(--color-text-dim)]" data-testid="ns-nofigure">{s.noFigure}</p>;
  const g = intervalGeometry(m);
  if (!g) return <p className="text-sm text-[var(--color-text)]" data-testid="ns-count">{m.k} {s.of} {m.n}. {s.noItems}</p>;
  const text = `${m.k} ${s.of} ${m.n}`;
  const interval = `${s.intervalLabel} ${pct(m.ciLow as number)} ${s.to} ${pct(m.ciHigh as number)}`;
  return (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text)]"><span className="font-medium" data-testid="ns-count">{text}</span> <span className="text-[var(--color-text-dim)]" data-testid="ns-interval">({interval})</span></p>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-3 w-full" role="img" aria-label={`${s.chartLabel}: ${s.measure[measure]}, ${text}, ${interval}`} data-testid="ns-chart">
        <rect x="0" y="4" width="100" height="2" fill="var(--color-border)" />
        <rect x={g.low} y="2" width={Math.max(g.high - g.low, 0.6)} height="6" fill="var(--color-accent)" opacity="0.55" />
        <rect x={Math.min(Math.max(g.point - 0.4, 0), 99.2)} y="0" width="0.8" height="10" fill="var(--color-text)" />
      </svg>
    </div>
  );
}

function Radio({ name, value, checked, onChange, label }: { name: string; value: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={`inline-flex min-h-6 cursor-pointer items-center gap-2 rounded-md border px-3 py-1 text-sm max-md:min-h-11 ${checked ? "border-[var(--color-accent)] text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-dim)]"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  );
}

/** The signed rows, with the unit and the group chosen by the reader; a row is a card with its two measures. No ranking, no sentence comparing rows. Shows nothing until R1's words are all set and there is at least one signed row. */
export function NyayaSiddhiResultsView({ rows, strings }: { rows: readonly ResultRow[]; strings: NyayaSiddhiStrings | null }) {
  const units = unitsOf(rows);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [group, setGroup] = useState<string>(ALL_GROUP);
  if (!strings || rows.length === 0) return null;
  const s = strings;
  const activeUnit = unit ?? units[0];
  const shown = rows.filter((r) => r.unit === activeUnit);
  const groups = groupsOf(rows, activeUnit).filter((g) => g === ALL_GROUP || s.family[g]); // a group R1 has not worded is not offered
  const activeGroup = groups.includes(group) ? group : ALL_GROUP;
  return (
    <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid="nyayasiddhi-results">
      <h2 className="text-base font-medium text-[var(--color-text)]">{s.heading}</h2>
      <p className="text-sm text-[var(--color-text)]">{s.intro}</p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--color-text)]">{s.unitHeading}</legend>
        <div className="flex flex-wrap gap-2" data-testid="ns-units">
          {units.map((u) => <Radio key={u} name="ns-unit" value={u} checked={u === activeUnit} onChange={() => setUnit(u)} label={s.unit[u]} />)}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--color-text)]">{s.groupHeading}</legend>
        <div className="flex flex-wrap gap-2" data-testid="ns-groups">
          {groups.map((g) => <Radio key={g} name="ns-group" value={g} checked={g === activeGroup} onChange={() => setGroup(g)} label={g === ALL_GROUP ? s.groupAll : s.family[g]} />)}
        </div>
      </fieldset>
      <ul className="space-y-3" aria-label={s.tableCaption} data-testid="ns-rows">
        {shown.map((r) => (
          <li key={r.rowId} className="space-y-3 rounded-md border border-[var(--color-border)] p-3" data-testid="ns-row">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-[var(--color-text-dim)]">{s.colSystem}</dt><dd className="text-[var(--color-text)]">{r.systemName} {r.systemVersion}</dd></div>
              <div><dt className="text-xs text-[var(--color-text-dim)]">{s.colStatus}</dt><dd className="text-[var(--color-text)]" data-testid="ns-status">{s.status[r.status]}</dd></div>
              <div><dt className="text-xs text-[var(--color-text-dim)]">{s.colSplit}</dt><dd className="text-[var(--color-text)]">{s.split[r.split]}</dd></div>
              <div><dt className="text-xs text-[var(--color-text-dim)]">{s.colRunDate}</dt><dd className="text-[var(--color-text)]">{r.runDate}</dd></div>
              <div><dd className="text-[var(--color-text)]" data-testid="ns-stack">{s.stackLabel}</dd></div>
              {r.organiserEntry && r.entryKind && <div><dd className="text-[var(--color-text)]" data-testid="ns-organiser">{s.organiserEntry[r.entryKind]}</dd></div>}
            </dl>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {MEASURES.map((name) => (
                <div key={name} className="space-y-1" data-testid={`ns-measure-${name === "coverage" ? "coverage" : "wrongly-supported"}`}>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">{s.measure[name]}</h3>
                  <p className="text-xs text-[var(--color-text-dim)]">{s.measureNote[name]}</p>
                  <Figure m={metricOf(r, name, activeGroup)} measure={name} s={s} />
                </div>
              ))}
            </div>
            {zeroWithZero(r, activeGroup) && <p className="text-sm text-[var(--color-text)]" data-testid="ns-zero-with-zero">{s.zeroWithZero}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The page's block: the signed rows from the build-time data file, with R1's words. Renders nothing (the page stays as it is) until both exist. */
export function NyayaSiddhiResults({ rows }: { rows: readonly ResultRow[] }) {
  return <NyayaSiddhiResultsView rows={rows} strings={resolveStrings()} />;
}
