// Data layer for the global command palette: the static page list (mirrors Sidebar.tsx's NAV, which is not
// exported so this list is kept here instead), the actions the palette can run, and the searchable records it
// pulls from the engine's own typed clients (lib/api.ts, lib/swarm.ts, lib/requests.ts). No React here — the
// component owns rendering and keyboard handling, this file owns what there is to find and what happens when
// something is chosen.

import {
  IS_DEMO,
  objectives as fetchObjectives,
  runs as fetchRuns,
  models as fetchModels,
  recipeLibrary,
  dispatchSubagents,
  stopRun,
  type Objective,
  type RunHandle,
  type PromotedModel,
  type Recipe,
} from "./api";
import { fixed } from "./num";

export interface PalettePage {
  id: string;
  label: string;
  href: string;
  icon: string;
  // Only the first nine sidebar entries get a bare-digit shortcut — "where sensible" per the ask, and ten-plus
  // single-digit slots would leave no digit free for anything else.
  digit?: number;
}

// This is the product edition of Pravrudhi, built from ADR-0049:
// The product never serves Studio pages — they are not in this list, and the engine's /api/roles.py::gate
// refuses them entirely. See https://github.com/AxisMeru/pravrudhi/blob/main/docs/decisions/ADR-0049-three-altitudes-studio-product-artifact.md §6.
export const STUDIO_ONLY_PAGES: ReadonlySet<string> = new Set();

// The sidebar keeps its own copy of this list, so the rule lives here and both ask it rather than each
// carrying its own idea of which pages are Studio's.
export function isStudioOnlyHref(href: string): boolean {
  return PALETTE_PAGES.some((p) => p.href === href && STUDIO_ONLY_PAGES.has(p.id));
}

export function pagesFor(isStudio: boolean): PalettePage[] {
  return isStudio ? PALETTE_PAGES : PALETTE_PAGES.filter((p) => !STUDIO_ONLY_PAGES.has(p.id));
}

export const PALETTE_PAGES: PalettePage[] = [
  { id: "start", label: "Start", href: "/start", icon: "Rocket", digit: 1 },
  { id: "improve", label: "Improve", href: "/", icon: "Sparkles", digit: 2 },
  { id: "objectives", label: "Objectives", href: "/objectives", icon: "Target", digit: 3 },
  { id: "progress", label: "Progress", href: "/progress", icon: "LineChart", digit: 4 },
  { id: "memory", label: "Memory", href: "/memory", icon: "Brain", digit: 5 },
  { id: "chat", label: "Chat", href: "/chat", icon: "MessageSquare", digit: 6 },
  { id: "nyaya", label: "Nyaya", href: "/nyaya", icon: "Scale", digit: 7 },
  { id: "runs", label: "Runs", href: "/runs", icon: "History", digit: 8 },
  { id: "models", label: "Models", href: "/models", icon: "Package", digit: 9 },
  { id: "catalogue", label: "Catalogue", href: "/catalogue", icon: "Library" },
  { id: "settings", label: "Settings", href: "/settings", icon: "Settings" },
  { id: "install", label: "Install", href: "/install", icon: "Download" },
];

export type PaletteGroup =
  | "Pages"
  | "Actions"
  | "Objectives"
  | "Runs"
  | "Models"
  | "Recipes";

export const GROUP_ORDER: PaletteGroup[] = [
  "Pages",
  "Actions",
  "Objectives",
  "Runs",
  "Models",
  "Recipes",
];

export interface PaletteRunResult {
  ok: boolean;
  message: string;
}

export interface PaletteResult {
  id: string;
  group: PaletteGroup;
  title: string;
  subtitle?: string;
  hint?: string;
  href?: string;
  run?: () => Promise<PaletteRunResult>;
  disabledReason?: string;
}

export interface PaletteIndex {
  objectives: Objective[];
  runs: RunHandle[];
  models: PromotedModel[];
  recipes: Recipe[];
}

export const EMPTY_INDEX: PaletteIndex = {
  objectives: [],
  runs: [],
  models: [],
  recipes: [],
};

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

// Every fetch here can fail independently (no engine, an older build missing an endpoint) — Promise.allSettled
// so one missing surface never blanks out the rest of the palette.
export async function loadPaletteIndex(): Promise<PaletteIndex> {
  const [objectivesRes, runsRes, modelsRes, recipesRes] =
    await Promise.allSettled([
      fetchObjectives(),
      fetchRuns(),
      fetchModels(),
      recipeLibrary(),
    ]);
  const objectivesData = settled(objectivesRes, { objectives: [], problems: [] });
  return {
    objectives: objectivesData.objectives,
    runs: settled(runsRes, []),
    models: settled(modelsRes, []),
    recipes: settled(recipesRes, []),
  };
}

const DEMO_REASON = "Demo mode — actions are disabled on this recording";

function pageResults(isStudio: boolean): PaletteResult[] {
  return pagesFor(isStudio).map((p) => ({
    id: `page:${p.id}`,
    group: "Pages",
    title: p.label,
    href: p.href,
    hint: p.digit ? String(p.digit) : undefined,
  }));
}

function globalActions(isDemo: boolean): PaletteResult[] {
  return [
    {
      id: "action:start-night",
      group: "Actions",
      title: "Start a night",
      subtitle: "Open the guided flow to launch a new run",
      href: "/start",
    },
  ];
}

function objectiveResults(items: Objective[], isDemo: boolean): PaletteResult[] {
  return items.flatMap((o) => {
    const base: PaletteResult = {
      id: `objective:${o.id}`,
      group: "Objectives",
      title: o.id,
      subtitle: `${o.track} · ${o.domain} — ${o.intent}`,
      href: "/objectives",
    };
    const dispatch: PaletteResult = {
      id: `action:dispatch:${o.id}`,
      group: "Actions",
      title: `Dispatch subagents — ${o.id}`,
      subtitle: "Run this objective's plan through the swarm now",
      disabledReason: isDemo ? DEMO_REASON : undefined,
      run: async () => {
        const res = await dispatchSubagents(o.id);
        const n = res.runs.length;
        return { ok: true, message: `Dispatched ${n} step${n === 1 ? "" : "s"}` };
      },
    };
    return [base, dispatch];
  });
}

function runResults(items: RunHandle[], isDemo: boolean): PaletteResult[] {
  return items.flatMap((r) => {
    const base: PaletteResult = {
      id: `run:${r.id}`,
      group: "Runs",
      title: r.id,
      subtitle: "Run",
      href: "/runs",
    };
    const stop: PaletteResult = {
      id: `action:stop:${r.id}`,
      group: "Actions",
      title: `Stop run — ${r.id}`,
      subtitle: "Send a stop signal to this run",
      disabledReason: isDemo ? DEMO_REASON : undefined,
      run: async () => {
        await stopRun(r.id);
        return { ok: true, message: `Stop requested for ${r.id}` };
      },
    };
    return [base, stop];
  });
}

function modelResults(items: PromotedModel[]): PaletteResult[] {
  return items.map((m) => ({
    id: `model:${m.id}`,
    group: "Models",
    title: m.id,
    subtitle: `${m.track} · night ${fixed(m.night, 0)}`,
    href: "/models",
  }));
}

function recipeResults(items: Recipe[]): PaletteResult[] {
  return items.map((r) => ({
    id: `recipe:${r.id}`,
    group: "Recipes",
    title: r.title,
    subtitle: `${r.capability} · ${r.available ? "installed" : "not installed"}`,
    href: "/catalogue",
  }));
}

// The full, unfiltered catalogue for one render pass. Cheap to rebuild on every index change — the arrays
// involved are all small (an operator's own objectives/candidates/runs, not a public dataset).
export function buildCatalogue(
  index: PaletteIndex, isDemo: boolean = IS_DEMO, isStudio: boolean = false,
): PaletteResult[] {
  return [
    ...pageResults(false),
    ...globalActions(isDemo),
    ...objectiveResults(index.objectives, isDemo),
    ...runResults(index.runs, isDemo),
    ...modelResults(index.models),
    ...recipeResults(index.recipes),
  ];
}

export function filterResults(all: PaletteResult[], query: string): PaletteResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return all.filter((r) => r.title.toLowerCase().includes(q) || (r.subtitle?.toLowerCase().includes(q) ?? false));
}

// ---------------------------------------------------------------------------
// Recents: the last few things chosen, kept per-browser so repeat work is one keystroke. Only navigable choices
// (pages and records) are remembered — a run() closure for an action like "Check for updates" cannot be
// reconstructed from JSON, so action-only entries are simply left out of this list.

const RECENTS_KEY = "pravrudhi.command-palette.recents";
const MAX_RECENTS = 5;

export interface PaletteRecent {
  id: string;
  group: PaletteGroup;
  title: string;
  subtitle?: string;
  href: string;
}

export function getRecents(): PaletteRecent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PaletteRecent[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: PaletteRecent): void {
  if (typeof window === "undefined") return;
  try {
    const next = [entry, ...getRecents().filter((r) => r.id !== entry.id)].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable (private mode, quota) — recents just don't persist this session */
  }
}
