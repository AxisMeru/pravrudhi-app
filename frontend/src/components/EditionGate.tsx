"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IS_DEMO } from "@/lib/api";
import { edition, STUDIO } from "@/lib/edition";
import { studioOnlyPath } from "@/lib/palette";
import { DEMO_HOME, gateDecision } from "@/lib/demoPath";

/**
 * The page-level half of edition separation, and it CLOSES the page: a typed URL, a bookmark or a link inside a page
 * to something the improvement loop owns is not rendered for anyone who is not Studio (Lead-2 decision on #525,
 * 2026-10-06). While the edition is still unknown the page waits (it is not rendered, so it makes none of its own
 * requests); an engine that cannot be reached reads as the product edition, so the page stays closed. The home page of
 * a non-Studio user goes to Matters. The same gate stops every route a law-firm build (the partner flag) does not
 * offer. The engine refuses the same surfaces on its side; this is the interface not offering them.
 */
export function EditionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ed, setEd] = useState<"studio" | "product" | null>(null);

  useEffect(() => {
    let off = false;
    edition()
      .then((e) => !off && setEd(e.edition === STUDIO ? "studio" : "product"))
      .catch(() => !off && setEd("product"));
    return () => {
      off = true;
    };
  }, []);

  const decision = gateDecision(pathname, ed, studioOnlyPath(pathname), undefined, IS_DEMO);

  useEffect(() => {
    if (decision === "redirect-home") router.replace(DEMO_HOME);
  }, [decision, router]);

  if (decision === "allow") return <>{children}</>;
  if (decision === "wait" || decision === "redirect-home") {
    return <div className="p-8 text-sm text-[var(--color-text-dim)]" data-testid="gate-wait" aria-busy="true" />;
  }
  return (
    <div className="mx-auto max-w-xl p-8 text-[var(--color-text)]" data-testid="not-on-this-surface">
      <h1 className="text-lg font-semibold tracking-tight">Not part of this edition</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        This edition offers the matter analysis, the statute text beside it and the citation check. Nothing is broken; this
        page is not offered here.
      </p>
    </div>
  );
}
