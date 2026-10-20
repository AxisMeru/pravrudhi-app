"use client";

import { useEffect, useState } from "react";

import { fetchServiceStatus } from "@/lib/serviceStatus";
import { parseStatusWorkflows } from "@/lib/workflowRegistry";

let pending: Promise<Record<string, boolean> | null> | null = null;

/** The engine's own list of switched-on workflows, read once from GET /api/v1/status (engine 0.6.24). Null until it answers, and when it cannot answer (an older engine without the field, an anonymous visitor of a hosted engine, an offline engine): the registry then uses its fallback and never hides a card. */
export function useEngineWorkflows(): Record<string, boolean> | null {
  const [wf, setWf] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    let live = true;
    pending ??= fetchServiceStatus().then((r) => (r.kind === "ok" ? parseStatusWorkflows((r.status as { workflows?: unknown }).workflows) : null)).catch(() => null);
    void pending.then((v) => { if (live) setWf(v); });
    return () => { live = false; };
  }, []);
  return wf;
}
