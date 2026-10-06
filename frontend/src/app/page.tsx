"use client";

// The home page: what this signed-in user has asked for and how far it has got. State one objective, get one
// artifact (ADR-0049 in AxisMeru/pravrudhi) - every band here is built only from data this product engine
// actually serves a user (api/roles.py's USER_FACING set), never from Studio's own self-improvement surfaces
// (appetite, heartbeat, swarm, nights, requests, candidates), which 404 here and never belonged on this page.
// See docs/decisions/reports/2026-09-12-s7-product-front-door.md for what used to be here and why it came out.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_HOME, DEMO_PATH } from "@/lib/demoPath";
import { IS_DEMO } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ResultBand } from "@/components/home/ResultBand";
import { NowBand } from "@/components/home/NowBand";
import { DoneBand } from "@/components/home/DoneBand";
import { useCanSeeRuns } from "@/lib/useCanSeeRuns";
import { NyayaBand } from "@/components/home/NyayaBand";
import { StartBand } from "@/components/home/StartBand";
import { loadHome, biggestResult, runningRun, doneStrip, type HomeData } from "@/lib/home";

const POLL_MS = 10000;

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const showRuns = useCanSeeRuns();
  const router = useRouter();

  useEffect(() => {
    if (DEMO_PATH) {
      router.replace(DEMO_HOME);
      return;
    }
    let cancelled = false;
    const refresh = () => loadHome().then((d) => !cancelled && setData(d));
    refresh();
    // Nothing changes in a recording, so only a live engine is worth re-polling.
    if (IS_DEMO) return;
    const id = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router]);

  return (
    <div>
      <PageHeader
        title="Pravrudhi"
        subtitle="What you've asked for, how far it's got, and what to point it at next."
      />
      <div className="space-y-6 p-8">
        {data ? (
          <>
            <ResultBand result={biggestResult(data.objectives)} />
            <NowBand running={runningRun(data.runHandles)} />
            <DoneBand strip={doneStrip(data)} showRuns={showRuns} />
            <NyayaBand asks={data.nyayaAsks} />
          </>
        ) : (
          <div className="h-64 animate-pulse rounded-lg bg-[var(--color-surface)]" />
        )}
        <StartBand />
      </div>
    </div>
  );
}
