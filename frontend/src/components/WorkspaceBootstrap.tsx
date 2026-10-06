"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { IS_DEMO, ensureDefaultWorkspace } from "@/lib/api";
import { edition } from "@/lib/edition";
import { shouldBootstrapWorkspace } from "@/lib/runsAccess";

// Provisions this account's workspace once per session, after a real sign-in — never while /signin is still
// the active route, so a half-finished sign-in never fires it. ensureDefaultWorkspace's own promise cache means
// this firing again on every route change (it does; usePathname changes on every navigation) only ever sends
// the one real request. Only the operator has a workspace to provision: the engine closes /api/workspaces to a member,
// so a member's interface never asks (no 403, no retry), and a refused or failed call here is caught, never an
// unhandled rejection. Renders nothing: a failure surfaces on the next workspace-scoped page fetch as the ordinary
// "could not reach" state, not from this component.
export function WorkspaceBootstrap() {
  const pathname = usePathname();
  const [access, setAccess] = useState<string | undefined>(undefined);
  useEffect(() => {
    let off = false;
    edition().then((e) => !off && setAccess(e.access)).catch(() => {});
    return () => {
      off = true;
    };
  }, []);
  useEffect(() => {
    if (pathname === "/signin") return;
    if (!currentSession()) return;
    if (!shouldBootstrapWorkspace(access, IS_DEMO)) return;
    ensureDefaultWorkspace().catch(() => {
      /* surfaces on the next workspace-scoped fetch */
    });
  }, [pathname, access]);
  return null;
}
