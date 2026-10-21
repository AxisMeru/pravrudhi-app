"use client";

import { useEffect, useRef, useState } from "react";
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
  Hammer,
  Gavel,
  ScanSearch,
  Library,
  Rocket,
  Menu,
  X,
  BookOpen,
  Workflow,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import type { ComponentType } from "react";
import { MatterBNav } from "@/components/MatterBNav";
import { LAYOUT_MATTER_B } from "@/lib/layoutFlag";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AccountControl } from "@/components/AccountControl";
import { citationNavOffered } from "@/lib/citationNav";
import { edition, PRODUCT, STUDIO, type Edition } from "@/lib/edition";
import { isStudioOnlyHref } from "@/lib/palette";
import { offeredInDemoPath } from "@/lib/demoPath";
import { WORKFLOWS_V2 } from "@/lib/workflowsV2Flag";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { GUIDE_NAV_LABEL } from "@/lib/guide/copy";
import { NAV_GROUP_LABELS, NAV_LABELS } from "@/lib/navCopy";
import { IS_DEMO } from "@/lib/api";
import { canSeeNotifications, canSeeRuns } from "@/lib/runsAccess";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

type NavGroupId = "work" | "reference" | "account" | "studio";
interface NavEntry extends NavItem {
  group: NavGroupId;
}

// Grouped navigation (Pravrudhi-Nyaya): labels changed, every path is as it was. The Studio group holds the improvement loop's own pages, which the rules
// below show only to the Studio edition.
const NAV: NavEntry[] = [
  { group: "work", href: "/screening", label: NAV_LABELS.screening, icon: ScanSearch },
  // /matters ("Offence rules", the contract-picker form) is not offered in the product nav (Lead-2, 14 Oct: it shows raw contract ids); the route and the page stay.
  { group: "work", href: "/citations", label: NAV_LABELS.citations, icon: Library },
  { group: "reference", href: "/workflows", label: NAV_LABELS.workflows, icon: Workflow },
  // Matter tools is the core workspace (Lead-2, 21 Oct): its own entry, next to Workflows wherever Workflows sits
  { group: "reference", href: "/matter-tools", label: NAV_LABELS.matterTools, icon: FolderOpen },
  { group: "reference", href: "/safety", label: NAV_LABELS.safety, icon: Gavel },
  { group: "reference", href: "/benchmarks", label: NAV_LABELS.benchmarks, icon: LineChart },
  { group: "reference", href: "/demo", label: NAV_LABELS.demo, icon: Scale },
  { group: "reference", href: "/how-it-was-built", label: NAV_LABELS.howBuilt, icon: Hammer },
  { group: "reference", href: "/guide", label: GUIDE_NAV_LABEL, icon: BookOpen },
  { group: "account", href: "/data-handling", label: NAV_LABELS.dataHandling, icon: ShieldCheck },
  { group: "account", href: "/settings", label: NAV_LABELS.settings, icon: Settings },
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
// With the workflows front door (NEXT_PUBLIC_WORKFLOWS_V2=1) Workflows leads the work group; otherwise it stays in the reference group as it was.
if (WORKFLOWS_V2) {
  const i = NAV.findIndex((n) => n.href === "/workflows");
  if (i >= 0) {
    const [w] = NAV.splice(i, 1);
    NAV.unshift({ ...w, group: "work" });
  }
}
// Matter tools sits directly after Workflows, in the same group.
{
  const w = NAV.findIndex((n) => n.href === "/workflows");
  const m = NAV.findIndex((n) => n.href === "/matter-tools");
  if (w >= 0 && m >= 0) {
    const group = NAV[w].group;
    const [entry] = NAV.splice(m, 1);
    NAV.splice(NAV.findIndex((n) => n.href === "/workflows") + 1, 0, { ...entry, group });
  }
}
const NAV_GROUP_ORDER: NavGroupId[] = ["work", "reference", "account", "studio"];

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
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // D2 (explorer review of the live alias): an open drawer is a modal dialog on a phone. Escape closes it and returns focus to its button; the page behind it is inert while it is open
  // (not focusable, not clickable, not read), so keyboard and screen-reader users stay inside the drawer until they close it.
  useEffect(() => {
    if (!navOpen) return;
    const main = document.getElementById("main");
    main?.setAttribute("inert", "");
    // The fixed theme button lives outside both the dialog and #main, so it would stay a Tab stop under the scrim (Track B, A1): it is inert and hidden from the accessibility tree while the drawer is open.
    const themeButton = document.getElementById("theme-button");
    themeButton?.setAttribute("inert", "");
    themeButton?.setAttribute("aria-hidden", "true");
    const onKey = (e: KeyboardEvent) => {
      // Layout B (matter-b): the open drawer is a proper dialog, so Tab and Shift+Tab stay inside it (the menu button, which closes it, counts as inside).
      if (LAYOUT_MATTER_B && e.key === "Tab") {
        const inside = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), summary, input, [tabindex]:not([tabindex='-1'])") ?? []).filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && (el.tagName === "SUMMARY" || !el.closest("details:not([open])")));
        const edge = [toggleRef.current, ...inside].filter((el): el is HTMLElement => !!el);
        if (edge.length > 0) {
          const first = edge[0], last = edge[edge.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || !edge.includes(active as HTMLElement))) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && (active === last || !edge.includes(active as HTMLElement))) { e.preventDefault(); first.focus(); }
        }
        return;
      }
      if (e.key !== "Escape") return;
      e.preventDefault();
      setNavOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    // From md up the sidebar is a normal column, not a drawer: if the window grows (tablet rotation, a widened window) while the drawer is open, close it, so the page behind is not left inert
    // and the sidebar does not keep a dialog role (R2, #211).
    const wide = window.matchMedia("(min-width: 768px)");
    const onWide = () => {
      if (wide.matches) setNavOpen(false);
    };
    wide.addEventListener("change", onWide);
    onWide();
    // focus moves into the dialog when it opens
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      main?.removeAttribute("inert");
      themeButton?.removeAttribute("inert");
      themeButton?.removeAttribute("aria-hidden");
    };
  }, [navOpen]);

  // A drawer that survives a route change hides the page the reader just asked for. Closing it here, during
  // render, rather than in an effect after the fact: React's own pattern for resetting state when a prop
  // changes (https://react.dev/reference/react/useState#storing-information-from-previous-renders) — comparing
  // against the previous pathname and calling setState directly in the render body avoids the extra commit an
  // effect would cause.
  // Layout B: an in-page link in the drawer changes only the hash, not the path, so it closes the drawer too (the jump would otherwise land behind the scrim, with the page inert).
  useEffect(() => {
    if (!LAYOUT_MATTER_B) return;
    const close = () => setNavOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);
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
        ref={toggleRef}
        type="button"
        onClick={() => setNavOpen((open) => !open)}
        aria-label={navOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={navOpen}
        aria-controls="primary-navigation"
        className="fixed left-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-lg md:hidden print:hidden"
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
      {/* D1: below `md` a CLOSED drawer is off-screen but its links, the account control and the theme button stayed in the tab order (13 stops at x<0). `max-md:invisible` takes it out of
          the focus order and the accessibility tree; from `md` up the sidebar is a normal column and is never hidden. Open, it is a modal dialog (D2). */}
      <aside
        ref={drawerRef}
        tabIndex={-1}
        id="primary-navigation"
        role={navOpen ? "dialog" : undefined}
        aria-modal={navOpen ? true : undefined}
        aria-label={navOpen ? "Navigation" : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-60 shrink-0 transform flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-200 md:static md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full max-md:invisible"
        }`}
      >
      <div className="border-b border-[var(--color-border)] px-5 py-5 max-md:pl-[68px]">
        <div className="flex items-center justify-between gap-2">
          <div data-testid="drawer-brand" className="min-w-0 text-lg font-semibold tracking-tight text-[var(--color-text)]">{whoami.edition}</div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeSwitch where="row" />
            {canSeeNotifications(whoami.access, IS_DEMO) && <NotificationBell />}
          </div>
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
        {LAYOUT_MATTER_B ? (
          <MatterBNav
            pathname={pathname}
            items={NAV.filter(({ href }) => offeredInDemoPath(href) && citationNavOffered(href) && (whoami.edition === STUDIO || !isStudioOnlyHref(href)))}
            studio={NAV.filter((n) => n.group === "studio").filter(({ href }) => whoami.edition === STUDIO && (href !== "/runs" || canSeeRuns(whoami.access, IS_DEMO)))}
          />
        ) : NAV_GROUP_ORDER.map((group) => {
          const items = NAV.filter((n) => n.group === group)
            .filter(({ href }) => offeredInDemoPath(href) && citationNavOffered(href) && (whoami.edition === STUDIO || !isStudioOnlyHref(href)))
            .filter(({ href }) => href !== "/runs" || canSeeRuns(whoami.access, IS_DEMO));
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-1" data-testid={`nav-group-${group}`}>
              <div className="px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-[var(--color-text-dim)]">{NAV_GROUP_LABELS[group]}</div>
              {items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors max-md:min-h-11 ${
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
      </aside>
    </>
  );
}
