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

/**
 * The link that travels with provision text where the page has no corpus source records to resolve (the memo is a pure
 * function of one engine result): the engine's own recorded source if it IS an https India Code URL, else the India Code
 * home page. Never a constructed deep link, and never a URL on another host.
 */
export function provisionSourceLink(source: string | null | undefined): string {
  for (const token of (source ?? "").split(/\s+/)) {
    const url = token.replace(/^[(<\[]+|[)>\].,;]+$/g, "");
    if (/^https:\/\//i.test(url) && isIndiaCodeHost(url)) return url;
  }
  return INDIA_CODE_HOME;
}
