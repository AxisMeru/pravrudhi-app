// The Citation check nav and palette entries (#75 item 3). The engine tells the client nothing about whether its citation index is set, so the
// entries are offered only when the build says so: NEXT_PUBLIC_CITATION_NAV=1, turned on together with the product-status flag, only after the
// index is set in production. The page itself stays reachable by URL and answers a 503 with the signed "index not available" sentence.
export const CITATION_NAV_ENABLED = process.env.NEXT_PUBLIC_CITATION_NAV === "1";

export function citationNavOffered(href: string, enabled: boolean = CITATION_NAV_ENABLED): boolean {
  return enabled || href !== "/citations";
}
