"use client";

import { useId, useRef, useState } from "react";

import { ALL_GROUP, MEASURES, groupsOf, intervalGeometry, errorLineFor, isNotRun, metricOf, orderRows, pct, unitsOf, zeroWithZero, type Measure, type Metric, type ResultRow, type Unit } from "@/lib/nyayasiddhiRows";
import { resolveStrings, type NyayaSiddhiStrings } from "@/lib/nyayasiddhi";
import { NS_DRAWER as D } from "@/lib/nyayasiddhiDrawer";
import type { RowLinks } from "@/lib/nyayasiddhiRowLinks";

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
    <label className={`relative inline-flex min-h-6 cursor-pointer items-center gap-2 rounded-md border px-3 py-1 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--color-accent)] max-md:min-h-11 ${checked ? "border-[var(--color-accent)] text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-dim)]"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  );
}

const EXTLINK = "inline-flex min-h-6 items-center text-[var(--color-accent)] underline max-md:min-h-11";

/** The details of one row in a native modal dialog (focus kept inside, Esc closes, focus returns to the button): the row's own stored values and, when it has them, the pinned public files. */
function RowDetails({ r, s, links }: { r: ResultRow; s: NyayaSiddhiStrings; links: RowLinks | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dt = "text-xs text-[var(--color-text-dim)]";
  const dd = "text-sm text-[var(--color-text)] break-words";
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="inline-flex min-h-[44px] items-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" data-testid="ns-row-details-open" aria-haspopup="dialog">{D.open_button}</button>
      <dialog ref={ref} aria-labelledby={titleId} className="max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text)] backdrop:bg-black/40" data-testid="ns-row-details">
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-base font-medium">{D.dialog_title}</h3>
          <button type="button" onClick={() => ref.current?.close()} className="inline-flex min-h-[44px] shrink-0 items-center rounded-md border border-[var(--color-border)] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" data-testid="ns-row-details-close">{D.close_button}</button>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <div><dt className={dt}>{D.field_system}</dt><dd className={dd}>{r.systemName}</dd></div>
          <div><dt className={dt}>{D.field_version}</dt><dd className={dd}>{r.systemVersion}</dd></div>
          <div><dt className={dt}>{D.field_split}</dt><dd className={dd}>{s.split[r.split]}</dd></div>
          <div><dt className={dt}>{D.field_unit}</dt><dd className={dd}>{s.unit[r.unit]}</dd></div>
          <div><dt className={dt}>{D.field_stack}</dt><dd className={dd}>{s.stackLabel[r.stack]}</dd></div>
          <div><dt className={dt}>{D.field_date}</dt><dd className={dd}>{r.runDate}</dd></div>
          <div><dt className={dt}>{D.field_status}</dt><dd className={dd}>{s.status[r.status]}</dd></div>
          <div><dt className={dt}>{D.field_errors}</dt><dd className={dd} data-testid="ns-detail-errors">{r.nError}</dd></div>
        </dl>
        {r.aboutRun.length > 0 && (
          <div className="mt-3" data-testid="ns-detail-about">
            <h4 className="text-sm font-medium">{D.field_about}</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{r.aboutRun.map((line, i) => <li key={i}>{line}</li>)}</ul>
          </div>
        )}
        {links && (
          <div className="mt-3 space-y-1" data-testid="ns-detail-links">
            <h4 className="text-sm font-medium">{D.links_heading}</h4>
            <p><a href={links.manifestUrl} target="_blank" rel="noopener noreferrer" className={EXTLINK} data-testid="ns-detail-manifest">{D.link_manifest}</a></p>
            <p><a href={links.predictionsUrl} target="_blank" rel="noopener noreferrer" className={EXTLINK} data-testid="ns-detail-predictions">{D.link_predictions}</a></p>
            <dl className="grid grid-cols-1 gap-y-2">
              <div><dt className={dt}>{D.hash_manifest}</dt><dd className={`${dd} font-mono text-xs`} data-testid="ns-detail-manifest-sha">{links.manifestSha256}</dd></div>
              <div><dt className={dt}>{D.hash_predictions}</dt><dd className={`${dd} font-mono text-xs`} data-testid="ns-detail-predictions-sha">{links.predictionsSha256}</dd></div>
            </dl>
            <p className="text-xs text-[var(--color-text-dim)]">{D.links_note}</p>
          </div>
        )}
      </dialog>
    </>
  );
}

/** The signed rows, with the unit and the group chosen by the reader; a row is a card with its two measures. No ranking, no sentence comparing rows. Shows nothing until R1's words are all set and there is at least one signed row. */
export function NyayaSiddhiResultsView({ rows, strings, initialGroup = ALL_GROUP, links = {} }: { rows: readonly ResultRow[]; strings: NyayaSiddhiStrings | null; initialGroup?: string; links?: Record<string, RowLinks> }) {
  // a row is shown only for a stack the words cover (fail closed: never a guessed label)
  const known = strings ? rows.filter((r) => Object.hasOwn(strings.stackLabel, r.stack)) : [];
  rows = known;
  const versions = [...new Set(rows.map((r) => r.benchmarkVersion))];
  const [version, setVersion] = useState<string | null>(null);
  const units = unitsOf(rows);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [group, setGroup] = useState<string>(initialGroup);
  if (!strings || rows.length === 0) return null;
  const s = strings;
  const activeVersion = version !== null && versions.includes(version) ? version : versions[0];
  rows = rows.filter((r) => r.benchmarkVersion === activeVersion);
  const activeUnit = unit ?? units[0];
  const shown = rows.filter((r) => r.unit === activeUnit);
  const groups = groupsOf(rows, activeUnit).filter((g) => g === ALL_GROUP || s.family[g]); // a group R1 has not worded is not offered
  const activeGroup = groups.includes(group) ? group : ALL_GROUP;
  return (
    <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid="nyayasiddhi-results">
      <h2 className="text-base font-medium text-[var(--color-text)]">{s.heading}</h2>
      <p className="text-sm text-[var(--color-text)]">{s.intro}</p>
      <p className="text-sm text-[var(--color-text)]" data-testid="ns-order-line">{s.orderLine}</p>
      <p className="text-sm text-[var(--color-text)]" data-testid="ns-supply-line">{s.benchmarksSupplyLine}</p>
      <fieldset className="space-y-2" data-testid="ns-versions">
        <legend className="text-sm font-medium text-[var(--color-text)]">{D.version_label}</legend>
        <div className="flex flex-wrap gap-2">
          {versions.map((v) => <Radio key={v} name="ns-version" value={v} checked={v === activeVersion} onChange={() => setVersion(v)} label={v} />)}
        </div>
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="ns-version-note">{D.version_note}</p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--color-text)]">{s.unitHeading}</legend>
        <div className="flex flex-wrap gap-2" data-testid="ns-units">
          {units.map((u) => <Radio key={u} name="ns-unit" value={u} checked={u === activeUnit} onChange={() => setUnit(u)} label={s.unit[u]} />)}
        </div>
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="ns-unit-note">{s.unitNote}</p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--color-text)]">{s.groupHeading}</legend>
        <div className="flex flex-wrap gap-2" data-testid="ns-groups">
          {groups.map((g) => <Radio key={g} name="ns-group" value={g} checked={g === activeGroup} onChange={() => setGroup(g)} label={g === ALL_GROUP ? s.groupAll : s.family[g]} />)}
        </div>
      </fieldset>
      <div className="space-y-5" data-testid="ns-rows">
      {orderRows(shown).map((g) => (
      <div key={g.split} className="space-y-3" data-testid="ns-split-section">
        <h3 className="text-sm font-medium text-[var(--color-text)]" data-testid="ns-split-heading">{s.split[g.split]}</h3>
        <ul className="space-y-3" aria-label={`${s.tableCaption}: ${s.split[g.split]}`}>
        {g.rows.map((r) => (
          <li key={r.rowId} className="space-y-3 rounded-md border border-[var(--color-border)] p-3" data-testid="ns-row">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-[var(--color-text-dim)]">{s.colSystem}</dt><dd className="text-[var(--color-text)]">{r.systemName} {r.systemVersion}</dd></div>
              <div><dt className="text-xs text-[var(--color-text-dim)]">{s.colStatus}</dt><dd className="text-[var(--color-text)]" data-testid="ns-status">{s.status[r.status]}</dd></div>
              <div><dt className="text-xs text-[var(--color-text-dim)]">{s.colSplit}</dt><dd className="text-[var(--color-text)]">{s.split[r.split]}</dd></div>
              <div><dt className="text-xs text-[var(--color-text-dim)]">{s.colRunDate}</dt><dd className="text-[var(--color-text)]">{r.runDate}</dd></div>
              <div><dd className="text-[var(--color-text)]" data-testid="ns-stack">{s.stackLabel[r.stack]}</dd></div>
              {r.organiserEntry && r.entryKind && <div><dd className="text-[var(--color-text)]" data-testid="ns-organiser">{s.organiserEntry[r.entryKind]}</dd></div>}
            </dl>
            {isNotRun(r, activeGroup) ? <p className="text-sm text-[var(--color-text)]" data-testid="ns-not-run">{s.notRunGroup}</p> : <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {MEASURES.map((name) => (
                <div key={name} className="space-y-1" data-testid={`ns-measure-${name === "coverage" ? "coverage" : "wrongly-supported"}`}>
                  <h4 className="text-sm font-medium text-[var(--color-text)]">{s.measure[name]}</h4>
                  <p className="text-xs text-[var(--color-text-dim)]">{s.measureNote[name]}</p>
                  <Figure m={metricOf(r, name, activeGroup)} measure={name} s={s} />
                </div>
              ))}
            </div>
            {(() => {
              const el = errorLineFor(r, activeGroup);
              if (!el) return null;
              const parts = [
                ...(el.wrong ? [s.errorPartWrong.replace("{k}", String(el.wrong.k)).replace("{n}", String(el.wrong.n))] : []),
                ...(el.coverage ? [s.errorPartCoverage.replace("{c}", String(el.coverage.c)).replace("{m}", String(el.coverage.m))] : []),
              ];
              return <p className="text-sm text-[var(--color-text)]" data-testid="ns-error-line">{s.errorLeadIn.replace("{e}", String(el.e)) + parts.join(s.errorJoin) + s.errorEnd}</p>;
            })()}
            {zeroWithZero(r, activeGroup) && <p className="text-sm text-[var(--color-text)]" data-testid="ns-zero-with-zero">{s.zeroWithZero}</p>}
            {activeGroup === ALL_GROUP && r.notRunGroups.length > 0 && <p className="text-sm text-[var(--color-text)]" data-testid="ns-not-run-all">{s.notRunAll}</p>}
            {activeGroup === "NI138" && (metricOf(r, "false_proof", "NI138") || metricOf(r, "coverage", "NI138")) && <p className="text-sm text-[var(--color-text)]" data-testid="ns-ni138-note">{s.ni138Note}</p>}
            </>}
            <RowDetails r={r} s={s} links={links[r.rowId]} />
            {r.aboutRun.length > 0 && (
              <details className="text-sm text-[var(--color-text)]" data-testid="ns-about-run">
                <summary className="flex min-h-[44px] cursor-pointer items-center font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{s.aboutRun}</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">{r.aboutRun.map((line, i) => <li key={i}>{line}</li>)}</ul>
              </details>
            )}
          </li>
        ))}
        </ul>
      </div>
      ))}
      </div>
    </section>
  );
}

/** The page's block: the signed rows from the build-time data file, with R1's words. Renders nothing (the page stays as it is) until both exist. */
export function NyayaSiddhiResults({ rows, links }: { rows: readonly ResultRow[]; links?: Record<string, RowLinks> }) {
  return <NyayaSiddhiResultsView rows={rows} strings={resolveStrings()} links={links} />;
}
