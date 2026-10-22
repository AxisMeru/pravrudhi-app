import file from "@/data/releases.json";

// The engine releases that were live in production (app#519): read from src/data/releases.json. A release is listed only with a real go-live time; the file is newest first and the page shows the last five.
export interface Release { engine: string; liveAt: string; line: string; showTime: boolean }

export function parseReleases(raw: unknown): Release[] {
  const list = (raw as { releases?: unknown } | null)?.releases;
  if (!Array.isArray(list)) return [];
  const out: Release[] = [];
  for (const r of list) {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o.engine !== "string" || typeof o.liveAt !== "string" || typeof o.line !== "string") continue;
    if (Number.isNaN(Date.parse(o.liveAt)) || o.engine === "" || o.line === "") continue;
    out.push({ engine: o.engine, liveAt: o.liveAt, line: o.line, showTime: o.showTime !== false });
  }
  return out.sort((a, b) => Date.parse(b.liveAt) - Date.parse(a.liveAt));
}

export const RELEASES: readonly Release[] = parseReleases(file);
export const lastReleases = (n = 5): readonly Release[] => RELEASES.slice(0, n);
export const releaseFor = (engine: string): Release | undefined => RELEASES.find((r) => r.engine === engine);
