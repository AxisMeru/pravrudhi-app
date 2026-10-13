"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  History,
  Package,
  Settings,
  Download,
  Target,
  MessageSquare,
  LineChart,
  Brain,
  Scale,
  Gavel,
  ScanSearch,
  Library,
  Rocket,
  Menu,
  X,
  BookOpen,
  Workflow,
  ShieldCheck,
} from "lucide-react";
import type { ComponentType } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { AccountControl } from "@/components/AccountControl";
import { citationNavOffered } from "@/lib/citationNav";
import { edition, PRODUCT, STUDIO, type Edition } from "@/lib/edition";
import { isStudioOnlyHref } from "@/lib/palette";
import { offeredInDemoPath } from "@/lib/demoPath";
import { GUIDE_NAV_LABEL } from "@/lib/guide/copy";
import { NAV_GROUP_LABELS, NAV_LABELS } from "@/lib/navCopy";
import { IS_DEMO } from "@/lib/api";
import { canSeeNotifications, canSeeRuns } from "@/lib/runsAccess";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

type NavGroupId = "work" | "firm" | "reference" | "studio";
interface NavEntry extends NavItem {
  group: NavGroupId;
}

// Grouped navigation (Pravrudhi-Nyaya): labels changed, every path is as it was. The Studio group holds the improvement loop's own pages, which the rules
// below show only to the Studio edition.
const NAV: NavEntry[] = [
  { group: "work", href: "/screening", label: NAV_LABELS.screening, icon: ScanSearch },
  { group: "work", href: "/matters", label: NAV_LABELS.matters, icon: Gavel },
  { group: "work", href: "/citations", label: NAV_LABELS.citations, icon: Library },
  { group: "firm", href: "/workflows", label: NAV_LABELS.workflows, icon: Workflow },
  { group: "firm", href: "/data-handling", label: NAV_LABELS.dataHandling, icon: ShieldCheck },
  { group: "firm", href: "/settings", label: NAV_LABELS.settings, icon: Settings },
  { group: "reference", href: "/safety", label: NAV_LABELS.safety, icon: Gavel },
  { group: "reference", href: "/benchmarks", label: NAV_LABELS.benchmarks, icon: LineChart },
  { group: "reference", href: "/demo", label: NAV_LABELS.demo, icon: Scale },
  { group: "reference", href: "/guide", label: GUIDE_NAV_LABEL, icon: BookOpen },
  { group: "studio", href: "/start", label: "Start", icon: Rocket },
  { group: "studio", href: "/", label: "Improve", icon: Sparkles },
  { group: "studio", href: "/objectives", label: "Objectives", icon: Target },
  { group: "studio", href: "/progress", label: "Progress", icon: LineChart },
  { group: "studio", href: "/memory", label: "Memory", icon: Brain },
  { group: "studio", href: "/catalogue", label: "Catalogue", icon: Library },
  { group: "studio", href: "/chat", label: "Chat", icon: MessageSquare },
  { group: "studio", href: "/nyaya", label: "Nyaya", icon: Scale },
  { group: "studio", href: "/runs", label: "Runs", icon: History },
  { group: "studio", href: "/models", label: "Models", icon: Package },
  { group: "studio", href: "/install", label: "Install", icon: Download },
];
const NAV_GROUP_ORDER: NavGroupId[] = ["work", "firm", "reference", "studio"];

export function Sidebar() {
  const pathname = usePathname();
  // The interface names itself from who is asking, so an operator sees Studio and a user sees the product.
  const [whoami, setWhoami] = useState<Edition>(PRODUCT);
  useEffect(() => {
    let off = false;
    edition().then((e) => !off && setWhoami(e)).catch(() => {});
    return () => { off = true; };
  }, []);

  const [navOpen, setNavOpen] = useState(false);

  // A drawer that survives a route change hides the page the reader just asked for. Closing it here, during
  // render, rather than in an effect after the fact: React's own pattern for resetting state when a prop
  // changes (https://react.dev/reference/react/useState#storing-information-from-previous-renders) — comparing
  // against the previous pathname and calling setState directly in the render body avoids the extra commit an
  // effect would cause.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
  }


  return (
    <>
      {/* Below `md` the sidebar is a drawer. It used to be a fixed 240px column at every width, which on a
          390px phone took 62% of the screen permanently and left 150px for the content — no overflow, so
          nothing caught it, just an app that could not be read on the device the operator actually carries. */}
      <button
        type="button"
        onClick={() => setNavOpen((open) => !open)}
        aria-label={navOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={navOpen}
        aria-controls="primary-navigation"
        className="fixed left-3 top-3 z-[60] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-text)] shadow-lg md:hidden"
      >
        {navOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
      </button>
      {navOpen ? (
        <div
          onClick={() => setNavOpen(false)}
          aria-hidden
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      ) : null}
      <aside
        id="primary-navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-60 shrink-0 transform flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-200 md:static md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="border-b border-[var(--color-border)] px-5 py-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-semibold tracking-tight text-[var(--color-text)]">{whoami.edition}</div>
          {canSeeNotifications(whoami.access, IS_DEMO) && <NotificationBell />}
        </div>
        {/* The product's line is long (it is read on the Screening page and the guide); the sidebar keeps the name, and the Studio edition its short tagline. */}
        {whoami.edition === STUDIO && (
          <p className="mt-1 text-xs leading-snug text-[var(--color-text-dim)]">
            {whoami.tagline}
          </p>
        )}
        <div className="mt-3">
          <AccountControl />
        </div>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {/* A product install does not serve the engine's self-improvement surfaces at all, so offering them
            here would be links that answer 404. The rule lives in lib/palette.ts, which the command palette
            asks too. */}
        {NAV_GROUP_ORDER.map((group) => {
          const items = NAV.filter((n) => n.group === group)
            .filter(({ href }) => offeredInDemoPath(href) && citationNavOffered(href) && (whoami.edition === STUDIO || !isStudioOnlyHref(href)))
            .filter(({ href }) => href !== "/runs" || canSeeRuns(whoami.access, IS_DEMO));
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-1" data-testid={`nav-group-${group}`}>
              <div className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-[var(--color-text-dim)]">{NAV_GROUP_LABELS[group]}</div>
              {items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                        : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <Icon size={16} />
                    <span className="flex-1">{label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-[var(--color-border)] p-3">
        <ThemeSwitch />
      </div>
      </aside>
    </>
  );
}
