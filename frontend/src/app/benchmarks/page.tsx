"use client";

import { useEffect, useState } from "react";

import { BoundBar, PairedView, ResultTableView } from "@/components/benchmarks/ResultTableView";
import { PageHeader } from "@/components/PageHeader";
import {
  FOOTER_TEXT,
  HOW_WE_TEST,
  NO_FIGURE_TEXT,
  PAGE_SUBTITLE,
  PAGE_TITLE,
  PENDING_TEXT,
  RANK_LINK_TEXT,
  parseBenchmarkResults,
  titleFor,
  type BlockView,
  type ParsedResults,
} from "@/lib/benchmarks";

// The page reads one data file beside the app (like demo.json) and shows a figure only from a reviewed block that passed the contract
// (lib/benchmarks.ts at runtime; the vendored validator in CI). Until then every block says "Result pending" and shows no number.
// Every result sentence is read from the data, where the validator has regenerated it from the numbers by template.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const chip = "rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs";

function Block({ v }: { v: BlockView }) {
  const f = v.figures;
  return (
    <section className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid={`block-${v.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-medium text-[var(--color-text)]">{titleFor(v)}</h2>
        <span className={`${chip} text-[var(--color-text)]`} data-testid={`chip-kind-${v.id}`}>
          {v.kindChip}
        </span>
        {v.dataChip && (
          <span className={`${chip} text-[var(--color-text-dim)]`} data-testid={`chip-data-${v.id}`}>
            {v.dataChip}
          </span>
        )}
        <span className={`${chip} text-[var(--color-text-dim)]`} data-testid={`status-${v.id}`}>
          {v.statusLabel}
        </span>
        {v.outcomeLabel && (
          <span className={`${chip} text-[var(--color-text)]`} data-testid={`outcome-${v.id}`}>
            {v.outcomeLabel}
          </span>
        )}
      </div>
      {v.fixedLabel && (
        <p className="text-sm text-[var(--color-text)]" data-testid={`fixed-label-${v.id}`}>
          {v.fixedLabel}
        </p>
      )}
      {!f && (
        <p className="text-sm text-[var(--color-text-dim)]" data-testid={`pending-${v.id}`}>
          {PENDING_TEXT}. {NO_FIGURE_TEXT}
        </p>
      )}
      {f && (
        <>
          <p className="text-sm text-[var(--color-text)]" data-testid={`what-it-is-${v.id}`}>
            <span className="font-medium">What it is: </span>
            {f.what_it_is}
          </p>
          <p className="text-sm text-[var(--color-text)]" data-testid={`what-it-is-not-${v.id}`}>
            <span className="font-medium">What it is not: </span>
            {f.what_it_is_not}
          </p>
          {f.copy.map((c) => (
            <p key={c.id} className="text-sm text-[var(--color-text)]" data-testid={`copy-${v.id}`}>
              {c.text}
            </p>
          ))}
          {f.tables.map((t, i) => (
            <ResultTableView key={i} table={t} />
          ))}
          {f.bounds.map((bd, i) => (
            <BoundBar key={i} bound={bd} />
          ))}
          {f.paired.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {f.paired.map((p, i) => (
                <PairedView key={i} pair={p} />
              ))}
            </div>
          )}
          {f.categories.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]" data-testid={`categories-${v.id}`}>
              {f.categories.map((c) => (
                <li key={c.label}>
                  {c.label}: {c.count}
                </li>
              ))}
            </ul>
          )}
          {f.sentences.length > 0 && (
            <ul className="space-y-1 text-sm text-[var(--color-text)]" data-testid={`sentences-${v.id}`}>
              {f.sentences.map((s, i) => (
                <li key={i}>{s.text}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-[var(--color-text-dim)]" data-testid={`limits-${v.id}`}>
            <span className="font-medium">Limits: </span>
            {f.limits}
          </p>
          {f.leaderboard && (
            <p className="text-sm text-[var(--color-text)]" data-testid={`leaderboard-${v.id}`}>
              Rank {f.leaderboard.rank} on {f.leaderboard.name} as of {f.leaderboard.as_of}, submitted by {f.leaderboard.submitted_by}.{" "}
              <a href={f.leaderboard.url} target="_blank" rel="noopener noreferrer" className="underline">
                {RANK_LINK_TEXT}
              </a>
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default function BenchmarksPage() {
  const [parsed, setParsed] = useState<ParsedResults | null>(null);

  useEffect(() => {
    let off = false;
    fetch(`${basePath}/benchmark_results.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((raw) => {
        if (!off) setParsed(parseBenchmarkResults(raw));
      });
    return () => {
      off = true;
    };
  }, []);

  const blocks = parsed?.blocks ?? parseBenchmarkResults(null).blocks;
  const reviewed = blocks.filter((b) => b.figures);
  return (
    <div>
      <PageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} />
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
        {blocks.map((b) => (
          <Block key={b.id} v={b} />
        ))}
        <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid="block-how">
          <h2 className="text-base font-medium text-[var(--color-text)]">How we test</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
            {HOW_WE_TEST.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <footer className="space-y-1 text-xs text-[var(--color-text-dim)]" data-testid="benchmarks-footer">
          {reviewed.map((b) => (
            <p key={b.id}>
              {b.title}: run {b.figures!.run.date}; models {b.figures!.run.model_ids.join(", ")}; revisions {b.figures!.run.revisions.join(", ")}; dataset revision{" "}
              {b.figures!.run.dataset_revision}; scorer sha256 {b.figures!.run.scorer_sha256}.
            </p>
          ))}
          {parsed?.generatedAt && <p>Page data generated {parsed.generatedAt}.</p>}
          <p className="text-sm font-medium text-[var(--color-text)]">{FOOTER_TEXT}</p>
        </footer>
      </div>
    </div>
  );
}
