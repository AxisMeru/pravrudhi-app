"use client";

import { useEffect, useState } from "react";

import { fetchServiceStatus } from "@/lib/serviceStatus";
import { parseStatusWorkflows, type WorkflowsRead } from "@/lib/workflowRegistry";

let pending: Promise<WorkflowsRead> | null = null;

/** What GET /api/v1/status (engine 0.6.24) says about the workflows, read once. unreadable: the status could not be read (offline, refused, not the status JSON, or an anonymous visitor of a hosted engine, for whom the app never asks the keyed status); none: it was read and carries no workflows field (an older engine); map: the engine's own list. */
export function useEngineWorkflows(): WorkflowsRead {
  const [read, setRead] = useState<WorkflowsRead>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    pending ??= fetchServiceStatus()
      .then((r): WorkflowsRead => {
        if (r.kind !== "ok") return { kind: "unreadable" };
        const map = parseStatusWorkflows((r.status as { workflows?: unknown }).workflows);
        return map ? { kind: "map", map } : { kind: "none" };
      })
      .catch((): WorkflowsRead => ({ kind: "unreadable" }));
    void pending.then((v) => { if (live) setRead(v); });
    return () => { live = false; };
  }, []);
  return read;
}
