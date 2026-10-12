// The hosted partner demo build (NEXT_PUBLIC_DEMO_PATH=1) offers the Indian-law demo path and nothing else:
// /nyaya's Lean tab carries two hard-coded US cases and its Ask tab depends on vendor health, so a partner
// clicking around would find content unrelated to the demo. Gated off, not deleted: a normal product or
// Studio install (flag unset) keeps every page. Navigation only; typed URLs and the engine are unchanged.

export const DEMO_PATH = process.env.NEXT_PUBLIC_DEMO_PATH === "1";

export const DEMO_HOME = "/screening";

// The demo path plus the settings page (keys, account). Nothing here is labelled experimental yet, so
// nothing experimental is offered.
export const DEMO_PATH_HREFS: readonly string[] = ["/screening", "/matters", "/citations", "/demo", "/safety", "/benchmarks", "/settings"];

export function offeredInDemoPath(href: string, on: boolean = DEMO_PATH): boolean {
  return !on || DEMO_PATH_HREFS.includes(href);
}

// The same flag is the law-firm product surface (Lead-2 decision on #525, 2026-10-06): a design partner's interface shows
// Matters, the statute view beside each element, the citation check, and sign-in/account only. Everything else the
// engine can do stays in the engine; it is simply not displayed or reachable from the interface. The nav and the
// palette use `offeredInDemoPath` (above); a TYPED URL or a bookmark is stopped by `routeAllowedOnSurface`, which
// also lets sign-in through (a user must be able to sign in) and the admin-only API keys page (its link is shown
// to org admins only, see the Settings page).
export const SURFACE_ROUTES: readonly string[] = ["/", "/screening", "/matters", "/demo", "/safety", "/benchmarks", "/citations", "/settings", "/signin", "/partner-keys"];

/**
 * The path as the router sees it, with every spelling of the same page folded together: query/hash dropped, slashes
 * collapsed, lower-cased, `.html` and a trailing `/index` removed. A static export serves `/nyaya.html` and `/nyaya/` as the
 * same page as `/nyaya`, so a deny-list over exact hrefs misses them; the gate compares this form against an ALLOW-list.
 */
export function normalizePath(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  let p = pathname.split(/[?#]/)[0].toLowerCase().replace(/\/{2,}/g, "/");
  p = p.replace(/\.html$/, "").replace(/\/index$/, "");
  p = p.replace(/\/+$/, "");
  return p === "" ? "/" : p.startsWith("/") ? p : `/${p}`;
}

/** Whether a path is one of the pages the law-firm surface offers (an allow-list over the normalised path). */
export function surfaceOpen(pathname: string | null | undefined): boolean {
  return SURFACE_ROUTES.includes(normalizePath(pathname));
}

export function routeAllowedOnSurface(pathname: string | null | undefined, on: boolean = DEMO_PATH): boolean {
  if (!on || !pathname) return true;
  return surfaceOpen(pathname);
}

export type GateDecision = "allow" | "block" | "wait" | "redirect-home";

/**
 * What the page-level gate does for one path. `edition` is "studio", "product" or null while it is not known yet.
 * For anyone who is not known to be Studio it is an ALLOW-list over the normalised path (R2, #50): only a page the surface
 * offers is rendered, in whatever spelling it arrives (`/nyaya.html`, `//nyaya`, `/Nyaya/`, `/index.html`); while the
 * edition is unknown it waits (renders nothing of the page), and the home page of a non-Studio user goes to Matters.
 * The recorded public demo (IS_DEMO) has no engine and no account and is shown as it always was.
 */
export function gateDecision(
  pathname: string | null | undefined,
  edition: "studio" | "product" | null,
  _loopPath: boolean,
  surface: boolean = DEMO_PATH,
  isDemo: boolean = false,
): GateDecision {
  if (surface && !surfaceOpen(pathname)) return "block";
  if (isDemo || edition === "studio") return "allow";
  // Anyone who is not (known to be) Studio gets an ALLOW-list: a path is rendered only if the surface offers it. A path
  // that is not on the list is never rendered, whatever spelling it arrives in, and a page nobody listed is closed by default.
  if (!surfaceOpen(pathname)) return edition === null ? "wait" : "block";
  if (normalizePath(pathname) === "/") return edition === null ? "wait" : "redirect-home";
  return "allow";
}
