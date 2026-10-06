// The licence condition on showing statute text (Lead-2, 2026-10-05; explorer licence memo on s.52(1)(q)(ii)):
// statute text is shown only beside our own element analysis, never as bare text, with this notice and a source
// link. The link comes from the corpus's own recorded source for the act; a deep link is never constructed.

export const STATUTE_NOTICE = "Unofficial text; the official version on India Code prevails.";

/** Where to send a reader when the corpus records no page for an act: the India Code home page, never a guessed deep link. */
export const INDIA_CODE_HOME = "https://www.indiacode.nic.in/";

interface SourceRecord {
  work?: unknown;
  site?: unknown;
  pages?: unknown;
}

function pageUrls(pages: unknown): string[] {
  if (!Array.isArray(pages)) return [];
  return pages
    .map((p) => (p && typeof p === "object" ? (p as { url?: unknown }).url : undefined))
    .filter((u): u is string => typeof u === "string");
}

const INDIA_CODE_HOSTS = new Set(["indiacode.gov.in", "www.indiacode.gov.in", "indiacode.nic.in", "www.indiacode.nic.in"]);

function parseHttps(u: string): URL | null {
  try {
    const url = new URL(u);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Whether a link points at India Code itself; only then may it be labelled "Source on India Code". */
export function isIndiaCodeHost(href: string): boolean {
  const url = parseHttps(href);
  return url !== null && INDIA_CODE_HOSTS.has(url.hostname.toLowerCase());
}

/**
 * The India Code page the corpus recorded for `act` (matched against the source record's `work`, which reads
 * "Bharatiya Nyaya Sanhita (2023)" for the act "Bharatiya Nyaya Sanhita"), else the India Code home page.
 * Only https India Code links the corpus itself recorded are returned.
 */
export function sourceLinkFor(act: string, sources: unknown): { href: string; recorded: boolean } {
  const want = act.trim().toLowerCase();
  // An engine that omits `sources` (or sends something else) must not break the caller: fall back to the home page.
  if (want && Array.isArray(sources)) {
    for (const s of sources as SourceRecord[]) {
      if (!s || typeof s !== "object") continue;
      const work = typeof s.work === "string" ? s.work.trim().toLowerCase() : "";
      // The act name must end where the work's name does or where its year begins: "(2023)" or ", 1860".
      if (!work.startsWith(want) || !/^\s*(\(|,|$)/.test(work.slice(want.length))) continue;
      // Only an India Code page is used as the act's link: another recorded host is not the official text.
      const url = pageUrls(s.pages).find(isIndiaCodeHost);
      if (url) return { href: url, recorded: true };
    }
  }
  return { href: INDIA_CODE_HOME, recorded: false };
}

/** The words for a source link: a recorded India Code page is "Source on India Code"; the home-page fallback is not a source for the act. */
export function sourceLinkLabel(href: string): string {
  if (href === INDIA_CODE_HOME) return "India Code (home page)";
  return isIndiaCodeHost(href) ? "Source on India Code" : "Source";
}

/** The fields of a corpus hit that decide its source link (the engine's `source_url` and `source_fallback_url`, pravrudhi #313). */
export interface HitSourceFields {
  act: string;
  source_url?: unknown;
  /** Typed for completeness and deliberately unused: the home-page fallback is this app's own INDIA_CODE_HOME. */
  source_fallback_url?: unknown;
}

// Printable ASCII only (no control character, space, zero-width or other non-ASCII character), as the engine's check requires.
function recordedUrl(u: unknown): string | null {
  if (typeof u !== "string" || u !== u.trim() || /[^\x21-\x7e]|[\\<>()[\]]/.test(u) || u.split("://").length !== 2) return null;
  const url = parseHttps(u);
  if (!url || url.username || url.password || url.port || !INDIA_CODE_HOSTS.has(url.hostname.toLowerCase())) return null;
  return url.href;
}

/**
 * The link for one corpus hit: the engine's per-hit `source_url` when it sent one (a page the corpus recorded, never
 * constructed; checked again here as an https India Code link), else, for an engine that predates the field, the
 * act's recorded page from `sources`, else the India Code home page.
 */
export function hitSourceLink(hit: HitSourceFields, sources: unknown): { href: string; recorded: boolean } {
  const url = recordedUrl(hit.source_url);
  if (url) return { href: url, recorded: true };
  if (hit.source_url === null || typeof hit.source_url === "string") return { href: INDIA_CODE_HOME, recorded: false };
  return sourceLinkFor(hit.act, sources);
}
