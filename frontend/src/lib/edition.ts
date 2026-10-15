// Which of the two products this interface is: Pravrudhi Studio builds Pravrudhi, and Pravrudhi builds the
// user's own work. The engine derives it from who is asking rather than from the build, so one interface names
// itself correctly whoever opened it — including an operator signing in as an ordinary user to see what their
// own product feels like.
//
// The recorded demo is the public site, which nobody is signed in to, so it shows the product.

import { IS_DEMO, apiBase, engineFetch, hasWebSession, isHostedEngine } from "@/lib/api";
import { PRODUCT_LINE, PRODUCT_NAME } from "@/lib/productCopy";

export interface Edition {
  edition: string;
  tagline: string;
  // The engine's word for who is asking: "admin" (the operator), "member" or "none". Absent from an older engine.
  access?: string;
}

// The name the engine reports when this install is the one that builds Pravrudhi itself. Compared against
// rather than assumed, so a surface is shown because the engine said Studio, not because nobody said product.
export const STUDIO = "Pravrudhi Studio";

// The product's name and line are SET HERE (lib/productCopy.ts, R1's words), not taken from the engine: the engine's own edition string and tagline are for the
// improvement loop's builder and read as a generic product. Only the Studio edition keeps what the engine reports.
export const PRODUCT: Edition = {
  edition: PRODUCT_NAME,
  tagline: PRODUCT_LINE,
};

export async function edition(): Promise<Edition> {
  if (IS_DEMO) return PRODUCT;
  // No web session on a hosted engine: an anonymous visitor, who is the product edition by definition; the identity probe would only log a 401 on every page (#137).
  if (isHostedEngine() && !(await hasWebSession())) return PRODUCT;
  try {
    // authOptional: true (2026-09-24) -- /api/me is an identity probe, not itself something a visitor asked
    // for. A genuinely anonymous visitor gets a 401 here on every page load; that must read as "anonymous,
    // product edition" below, never as a reason to redirect them to /signin before the page they came for
    // has even rendered. Identity itself stays strictly authenticated server-side -- this only changes what
    // the FRONTEND does with a 401 it was always going to get from an anonymous visitor.
    const res = await engineFetch(`${apiBase()}/api/me`, { cache: "no-store", authOptional: true });
    if (!res.ok) return PRODUCT;
    const body = (await res.json()) as Partial<Edition>;
    const access = typeof body.access === "string" ? body.access : undefined;
    // Studio keeps the engine's own words; every other edition is the product, named and described here.
    if (body.edition === STUDIO) return { edition: STUDIO, tagline: body.tagline || "", access };
    return { edition: PRODUCT.edition, tagline: PRODUCT.tagline, access };
  } catch {
    // An engine that cannot be reached is not a reason to show no name at all.
    return PRODUCT;
  }
}
