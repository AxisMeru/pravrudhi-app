// The hosted partner demo build (NEXT_PUBLIC_DEMO_PATH=1) offers the Indian-law demo path and nothing else:
// /nyaya's Lean tab carries two hard-coded US cases and its Ask tab depends on vendor health, so a partner
// clicking around would find content unrelated to the demo. Gated off, not deleted: a normal product or
// Studio install (flag unset) keeps every page. Navigation only; typed URLs and the engine are unchanged.

export const DEMO_PATH = process.env.NEXT_PUBLIC_DEMO_PATH === "1";

export const DEMO_HOME = "/matters";

// The demo path plus the settings page (keys, account). Nothing here is labelled experimental yet, so
// nothing experimental is offered.
export const DEMO_PATH_HREFS: readonly string[] = ["/matters", "/settings"];

export function offeredInDemoPath(href: string, on: boolean = DEMO_PATH): boolean {
  return !on || DEMO_PATH_HREFS.includes(href);
}

// The same flag is the law-firm product surface (Lead-2 decision on #525, 2026-10-06): a design partner's interface shows
// Matters, the statute view beside each element, the citation check, and sign-in/account only. Everything else the
// engine can do stays in the engine; it is simply not displayed or reachable from the interface. The nav and the
// palette use `offeredInDemoPath` (above); a TYPED URL or a bookmark is stopped by `routeAllowedOnSurface`, which
// also lets sign-in through (a user must be able to sign in) and the admin-only API keys page (its link is shown
// to org admins only, see the Settings page).
export const SURFACE_ROUTES: readonly string[] = ["/", "/matters", "/citations", "/settings", "/signin", "/partner-keys"];

export function routeAllowedOnSurface(pathname: string | null | undefined, on: boolean = DEMO_PATH): boolean {
  if (!on || !pathname) return true;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return SURFACE_ROUTES.includes(path);
}
