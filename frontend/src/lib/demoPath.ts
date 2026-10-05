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
