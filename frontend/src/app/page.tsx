"use client";

// "/" (app#539). The product edition's Home: a landing for a signed-out visitor, the workspace home for a signed-in user (no engine call is needed to render either). The Studio edition keeps its own Improve page unchanged.

import { useEffect, useState } from "react";

import { Landing } from "@/components/productHome/Landing";
import { WorkspaceHome } from "@/components/productHome/WorkspaceHome";
import { StudioHome } from "@/components/home/StudioHome";
import { edition, STUDIO, type Edition } from "@/lib/edition";
import { HOME_COPY } from "@/lib/productHome/copy";

export default function HomePage() {
  const [who, setWho] = useState<Edition | null>(null);
  useEffect(() => {
    let live = true;
    void edition().then((e) => { if (live) setWho(e); });
    return () => { live = false; };
  }, []);
  if (who === null) return <div className="p-8 text-sm text-[var(--color-text-dim)]" data-testid="home-loading">{HOME_COPY.loading}</div>;
  if (who.edition === STUDIO) return <StudioHome />;
  // Signed in = the engine named an access level for this caller (member or admin); anyone else, and an engine with no identity, sees the landing.
  return who.access === "member" || who.access === "admin" ? <WorkspaceHome isAdmin={who.access === "admin"} /> : <Landing />;
}
