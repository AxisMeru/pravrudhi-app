"use client";

import { useEffect, useState } from "react";
import { IS_DEMO } from "@/lib/api";
import { edition } from "@/lib/edition";
import { canSeeRuns } from "@/lib/runsAccess";

// Whether to offer the Runs surfaces to this caller: only when the engine says admin (the recorded demo keeps them).
// False until the engine has answered, so a non-admin never sees them flash.
export function useCanSeeRuns(): boolean {
  const [show, setShow] = useState(IS_DEMO);
  useEffect(() => {
    let off = false;
    edition().then((e) => !off && setShow(canSeeRuns(e.access, IS_DEMO))).catch(() => {});
    return () => { off = true; };
  }, []);
  return show;
}
