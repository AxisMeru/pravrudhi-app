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

function isHttps(u: string): boolean {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The India Code page the corpus recorded for `act` (matched against the source record's `work`, which reads
 * "Bharatiya Nyaya Sanhita (2023)" for the act "Bharatiya Nyaya Sanhita"), else the India Code home page.
 * Only https links the corpus itself recorded are returned.
 */
export function sourceLinkFor(act: string, sources: Record<string, unknown>[]): { href: string; recorded: boolean } {
  const want = act.trim().toLowerCase();
  if (want) {
    for (const s of sources as SourceRecord[]) {
      const work = typeof s.work === "string" ? s.work.trim().toLowerCase() : "";
      // The act name must end where the work's name does or where its year begins: "(2023)" or ", 1860".
      if (!work.startsWith(want) || !/^\s*(\(|,|$)/.test(work.slice(want.length))) continue;
      const url = pageUrls(s.pages).find(isHttps);
      if (url) return { href: url, recorded: true };
    }
  }
  return { href: INDIA_CODE_HOME, recorded: false };
}
