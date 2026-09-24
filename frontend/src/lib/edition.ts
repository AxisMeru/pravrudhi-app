// Which of the two products this interface is: Pravrudhi Studio builds Pravrudhi, and Pravrudhi builds the
// user's own work. The engine derives it from who is asking rather than from the build, so one interface names
// itself correctly whoever opened it — including an operator signing in as an ordinary user to see what their
// own product feels like.
//
// The recorded demo is the public site, which nobody is signed in to, so it shows the product.

import { IS_DEMO, apiBase, engineFetch } from "@/lib/api";

export interface Edition {
  edition: string;
  tagline: string;
}

// The name the engine reports when this install is the one that builds Pravrudhi itself. Compared against
// rather than assumed, so a surface is shown because the engine said Studio, not because nobody said product.
export const STUDIO = "Pravrudhi Studio";

export const PRODUCT: Edition = {
  edition: "Pravrudhi",
  tagline: "Improve your own model, agent or app, on your own hardware, while you watch.",
};

export async function edition(): Promise<Edition> {
  if (IS_DEMO) return PRODUCT;
  try {
    // authOptional: true (2026-09-24) -- /api/me is an identity probe, not itself something a visitor asked
    // for. A genuinely anonymous visitor gets a 401 here on every page load; that must read as "anonymous,
    // product edition" below, never as a reason to redirect them to /signin before the page they came for
    // has even rendered. Identity itself stays strictly authenticated server-side -- this only changes what
    // the FRONTEND does with a 401 it was always going to get from an anonymous visitor.
    const res = await engineFetch(`${apiBase()}/api/me`, { cache: "no-store", authOptional: true });
    if (!res.ok) return PRODUCT;
    const body = (await res.json()) as Partial<Edition>;
    return {
      edition: body.edition || PRODUCT.edition,
      tagline: body.tagline || PRODUCT.tagline,
    };
  } catch {
    // An engine that cannot be reached is not a reason to show no name at all.
    return PRODUCT;
  }
}
