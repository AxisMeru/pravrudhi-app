"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { ensureDefaultWorkspace } from "@/lib/api";

// Provisions this account's workspace once per session, after a real sign-in — never while /signin is still
// the active route, so a half-finished sign-in never fires it. ensureDefaultWorkspace's own promise cache means
// this firing again on every route change (it does; usePathname changes on every navigation) only ever sends
// the one real request. Renders nothing: a failure here surfaces on the next workspace-scoped page fetch as
// the ordinary "could not reach" state, not from this component.
export function WorkspaceBootstrap() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/signin") return;
    if (!currentSession()) return;
    void ensureDefaultWorkspace();
  }, [pathname]);
  return null;
}
