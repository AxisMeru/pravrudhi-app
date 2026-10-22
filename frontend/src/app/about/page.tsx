"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { ABOUT_COPY as T } from "@/lib/aboutCopy";
import { APP_SHA, BUILD_TIME, formatBst, formatBstDate, shortSha } from "@/lib/buildInfo";
import { useEngineRead } from "@/lib/engineHealth";
import { GUIDE_NAV_LABEL } from "@/lib/guide/copy";
import { NAV_LABELS } from "@/lib/navCopy";
import { problemReportText } from "@/lib/problemReport";
import { lastReleases, releaseFor } from "@/lib/releases";

const CARD = "space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const ROW = "flex flex-wrap gap-x-2 text-sm text-[var(--color-text)]";
const LINK = "inline-flex min-h-6 items-center text-[var(--color-accent)] underline max-md:min-h-11";

const PAGES: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/guide", label: GUIDE_NAV_LABEL },
  { href: "/how-it-was-built", label: NAV_LABELS.howBuilt },
  { href: "/benchmarks", label: NAV_LABELS.benchmarks },
  { href: "/data-handling", label: NAV_LABELS.dataHandling },
];

export default function AboutPage() {
  const read = useEngineRead();
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const engine = read.kind === "ok" ? read.version : null;
  const released = engine ? releaseFor(engine) : undefined;
  const releasedText = released ? (released.showTime ? formatBst(released.liveAt) : formatBstDate(released.liveAt)) : "";
  const statusText = read.kind === "loading" ? T.checking : read.kind === "ok" ? T.statusRunning : T.statusDown;

  async function copy() {
    const text = problemReportText({ sha: APP_SHA, builtAt: BUILD_TIME, engine, running: read.kind === "loading" ? null : read.kind === "ok", url: window.location.href, userAgent: navigator.userAgent, now: new Date() });
    try {
      await navigator.clipboard.writeText(text);
      setFallback(null);
      setCopied(true);
    } catch {
      setCopied(false);
      setFallback(text);
    }
  }

  return (
    <div>
      <PageHeader title={T.title} subtitle={T.subtitle} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8" data-testid="about">
        <section className={CARD} aria-labelledby="about-versions" data-testid="about-versions">
          <h2 id="about-versions" className="text-base font-medium text-[var(--color-text)]">{T.versionsHeading}</h2>
          <p className={ROW}><span className="font-medium">{T.appLabel}</span><span data-testid="about-app">{shortSha(APP_SHA)}</span></p>
          {BUILD_TIME && <p className={ROW}><span className="font-medium">{T.builtLabel}</span><span data-testid="about-built">{formatBst(BUILD_TIME)}</span></p>}
          <p className={ROW}>
            <span className="font-medium">{T.engineLabel}</span>
            <span data-testid="about-engine">{read.kind === "loading" ? T.checking : read.kind === "ok" ? read.version : T.engineUnavailable}</span>
          </p>
          {read.kind === "ok" && (
            <p className={ROW}><span className="font-medium">{T.engineReleasedLabel}</span><span data-testid="about-engine-released">{releasedText || T.releasedUnknown}</span></p>
          )}
          <p className={ROW} role="status" data-testid="about-status">{statusText}</p>
        </section>
        <section className={CARD} aria-labelledby="about-new" data-testid="about-new">
          <h2 id="about-new" className="text-base font-medium text-[var(--color-text)]">{T.newHeading}</h2>
          {lastReleases().length === 0 ? (
            <p className="text-sm text-[var(--color-text)]">{T.newEmpty}</p>
          ) : (
            <ul className="space-y-2 text-sm text-[var(--color-text)]">
              {lastReleases().map((r) => (
                <li key={r.engine} data-testid="about-release">
                  <span className="font-medium">{r.showTime ? formatBst(r.liveAt) : formatBstDate(r.liveAt)}</span> · {T.engineLabel} {r.engine} · {r.line}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={CARD} aria-labelledby="about-report" data-testid="about-report">
          <h2 id="about-report" className="text-base font-medium text-[var(--color-text)]">{T.reportHeading}</h2>
          <button type="button" onClick={copy} data-testid="about-copy" className="inline-flex min-h-8 w-fit items-center rounded-md border border-[var(--color-control-border)] px-3 text-sm text-[var(--color-text)] max-md:min-h-11">
            {T.copyButton}
          </button>
          {copied && <p className="text-sm text-[var(--color-text)]" role="status" data-testid="about-copied">{T.copied}</p>}
          {fallback !== null && (
            <label className="block text-sm text-[var(--color-text)]">
              {T.copyFallbackLabel}
              <textarea readOnly value={fallback} rows={8} className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 font-mono text-xs" data-testid="about-fallback" onFocus={(e) => e.currentTarget.select()} />
            </label>
          )}
        </section>
        <section className={CARD} aria-labelledby="about-pages" data-testid="about-pages">
          <h2 id="about-pages" className="text-base font-medium text-[var(--color-text)]">{T.pagesHeading}</h2>
          <ul className="space-y-1 text-sm">
            {PAGES.map((p) => (
              <li key={p.href}><Link href={p.href} className={LINK}>{p.label}</Link></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
