"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { CITATIONS_PANEL_ENABLED } from "@/lib/citationNav";
import { HEARING_PREP_BUILT, WORKSPACE_ANCHORS, WORKSPACE_STEP_LABELS } from "@/lib/workspace";
import { MB, useMbState } from "@/lib/screening/matterB";

export interface MbNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  group: string;
}

const LINK = "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors max-md:min-h-11";
const IDLE = "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]";
const ACTIVE = "bg-[var(--color-surface-raised)] text-[var(--color-text)]";

/**
 * The grouped navigation of layout B (matter-b). Static: no matter list, no switcher, no collapse, no stored state. On /screening a "This screening" block holds in-page links to the sections that exist on the page;
 * the groups below are General (Matter, Citation check, Workflows, Settings), Reference (a disclosure) and, for the Studio edition, the Studio group unchanged. Every item is one the live nav already has, with its own label and path.
 */
export function MatterBNav({ items, pathname, studio }: { items: MbNavItem[]; pathname: string; studio: MbNavItem[] }) {
  const mb = useMbState();
  const onScreening = pathname.startsWith("/screening");
  const by = (href: string) => items.find((i) => i.href === href);
  const general = ["/citations", "/workflows", "/settings"].map(by).filter((i): i is MbNavItem => !!i);
  const reference = ["/data-handling", "/guide", "/safety", "/benchmarks", "/demo", "/how-it-was-built"].map(by).filter((i): i is MbNavItem => !!i);
  const link = (i: MbNavItem) => {
    const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
    return (
      <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={`${LINK} ${active ? ACTIVE : IDLE}`}>
        <i.icon size={16} />
        <span className="flex-1">{i.label}</span>
      </Link>
    );
  };
  const heading = "px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-[var(--color-text-dim)]";
  // The "This screening" group is on every page: on /screening its links are in-page anchors (the section the page is showing is the current one); elsewhere "Facts" links to the page, so /screening stays reachable without a General item.
  const anchors: Array<{ href: string; label: string; current: boolean }> = [];
  if (onScreening) {
    anchors.push({ href: `#${WORKSPACE_ANCHORS.facts}`, label: MB.factsLabel, current: mb.view === "intake" });
    if (mb.hasResult) anchors.push({ href: "#screening-result", label: MB.resultLabel, current: mb.view === "result" });
    if (mb.hasResult && HEARING_PREP_BUILT) anchors.push({ href: `#${WORKSPACE_ANCHORS.hearing}`, label: WORKSPACE_STEP_LABELS.hearing, current: false });
    if (mb.hasResult && CITATIONS_PANEL_ENABLED) anchors.push({ href: "#step-citations", label: "Case citations", current: false });
  } else {
    anchors.push({ href: `/screening#${WORKSPACE_ANCHORS.facts}`, label: MB.factsLabel, current: false });
  }
  return (
    <>
      <div className="mb-1" data-testid="mb-screening-group" aria-labelledby="mb-screening-heading" role="group">
        <h2 id="mb-screening-heading" className={heading}>{MB.screeningLabel}</h2>
        {onScreening && mb.exampleName && <p className="px-3 pb-1 text-sm text-[var(--color-text)]" data-testid="mb-screening-name">{mb.exampleName} {MB.exampleSuffix}</p>}
        {onScreening && mb.hasResult && mb.runRecord && !mb.exampleName && <p className="px-3 pb-1 text-xs text-[var(--color-text-dim)]" data-testid="mb-retention">{MB.retention}</p>}
        {anchors.map((a) => (
          onScreening ? (
            <a key={a.href} href={a.href} aria-current={a.current ? "location" : undefined} className={`${LINK} ${a.current ? ACTIVE : IDLE}`}>{a.label}</a>
          ) : (
            <Link key={a.href} href={a.href} className={`${LINK} ${IDLE}`}>{a.label}</Link>
          )
        ))}
      </div>
      <div className="mb-1" role="group" aria-labelledby="mb-general-heading" data-testid="mb-group-general">
        <h2 id="mb-general-heading" className={heading}>{MB.groupGeneral}</h2>
        {general.map(link)}
      </div>
      <details className="group mb-1" data-testid="mb-group-reference">
        <summary className={`${heading} flex cursor-pointer list-none items-center justify-between max-md:min-h-11 max-md:py-3`}>
          {MB.groupReference}
          <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" data-testid="mb-reference-chevron" />
        </summary>
        {reference.map(link)}
      </details>
      {studio.length > 0 && (
        <div className="mb-1" role="group" aria-label="Studio" data-testid="mb-group-studio">
          {studio.map(link)}
        </div>
      )}
    </>
  );
}
