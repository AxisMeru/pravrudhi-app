"use client";

import { useState } from "react";
import { nyayaCorpus, type AnalyseFactsCitation } from "@/lib/api";
import { StatuteNotice } from "@/components/StatuteNotice";
import { citationQuery, pickCorpusHit } from "@/lib/surfaceCopy";
import { hitSourceLink } from "@/lib/statuteNotice";

// The statute text for the provisions a contract is about, shown ONLY here, beside the analysis, always with the notice
// and a source link. Loaded when the reader opens it, never with the page. A provision the corpus does not hold is
// named without text: nothing is invented.
export function StatuteBeside({ citations }: { citations: AnalyseFactsCitation[] | null | undefined }) {
  const [state, setState] = useState<"closed" | "loading" | "ready" | "error">("closed");
  const [shown, setShown] = useState<{ ref: AnalyseFactsCitation; title: string; text: string; href: string }[]>([]);
  const refs = Array.isArray(citations) ? citations : [];
  if (refs.length === 0) return null;

  async function open() {
    setState("loading");
    try {
      const found: typeof shown = [];
      for (const ref of refs) {
        const q = citationQuery(ref);
        if (!q || !ref.corpus_id) continue;
        const r = await nyayaCorpus(q);
        const hit = pickCorpusHit(r.hits, ref.corpus_id);
        if (hit) found.push({ ref, title: hit.title, text: hit.text, href: hitSourceLink(hit, Array.isArray(r.sources) ? r.sources : []).href });
      }
      setShown(found);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-testid="statute-beside">
      <div className="font-medium text-[var(--color-text)]">
        Statute: {refs.map((r) => (r.section ? `${r.act} s.${r.section}` : r.act)).join("; ")}
      </div>
      {state === "closed" && (
        <button type="button" onClick={open} className="mt-1 underline">
          Show the statute text
        </button>
      )}
      {state === "loading" && <p className="mt-1 text-[var(--color-text-dim)]">Loading…</p>}
      {state === "error" && <p className="mt-1 text-amber-400">The statute text could not be loaded.</p>}
      {state === "ready" && (
        <div className="mt-2 space-y-3">
          {shown.length === 0 && <p className="text-[var(--color-text-dim)]">The text of these provisions is not in the corpus.</p>}
          {shown.map((s) => (
            <div key={s.ref.corpus_id ?? s.title}>
              <div className="font-medium text-[var(--color-text)]">{s.title}</div>
              <div className="mt-1 whitespace-pre-wrap text-[var(--color-text-dim)]">{s.text}</div>
              <StatuteNotice className="mt-1" href={s.href} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
