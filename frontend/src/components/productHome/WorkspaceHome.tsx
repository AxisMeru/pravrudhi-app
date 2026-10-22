"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { HOME_COPY as C, HOME_QUICK, HOME_WORKFLOW_KEYS } from "@/lib/productHome/copy";
import { readModelsState, type ModelsState } from "@/lib/productHome/status";
import { REGISTRY } from "@/lib/workflowRegistry";
import { parseMyMatters, previewPost, type MyMatter } from "@/lib/previewApi";
import { YOUR_MATTERS_TEXT as Y, matterLabel, papersCount } from "@/lib/yourMatters";

const SHOWN = 5;
type MattersState = { kind: "loading" } | { kind: "off" } | { kind: "error" } | { kind: "list"; matters: MyMatter[] };

const MODELS_TEXT: Record<Exclude<ModelsState, "none">, string> = { ready: C.modelsReady, starting: C.modelsStarting, off: C.modelsOff, unavailable: C.modelsUnavailable };

/** The signed-in Home at "/" (app#539): Start a screening (it only opens the Screening page; nothing is woken), the models line, the five most recent matters, three workflows, quick links, and for an administrator "Invite people". No new engine call: the matters list and the status are the calls the other pages already make; the page renders without either. */
export function WorkspaceHome({ isAdmin }: { isAdmin: boolean }) {
  const [models, setModels] = useState<ModelsState | null>(null);
  const [matters, setMatters] = useState<MattersState>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    const ac = new AbortController();
    void readModelsState(ac.signal).then((s) => { if (live) setModels(s); });
    void previewPost("/matter-spans/my-matters", {}, undefined, true).then((a) => {
      if (!live) return;
      if ([401, 403, 404, 405, 409, 501].includes(a.status)) return setMatters({ kind: "off" });
      const p = a.status === 200 ? parseMyMatters(a.body) : null;
      setMatters(p ? { kind: "list", matters: p.matters } : { kind: "error" });
    }).catch(() => { if (live) setMatters({ kind: "error" }); });
    return () => { live = false; ac.abort(); };
  }, []);

  const workflows = HOME_WORKFLOW_KEYS.map((k) => REGISTRY.find((e) => e.key === k)).filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:p-8" data-testid="home-workspace">
      <section>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{C.workspaceHeading}</h1>
        <p className="mt-3">
          <Link href="/screening" className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-accent)]" data-testid="home-start">{C.startScreening}</Link>
        </p>
        {models !== null && models !== "none" && <p className="mt-2 text-sm text-[var(--color-text)]" data-testid="home-models">{MODELS_TEXT[models]}</p>}
      </section>
      {matters.kind !== "off" && (
        <section aria-labelledby="home-matters-heading" data-testid="home-matters">
          <h2 id="home-matters-heading" className="text-base font-medium text-[var(--color-text)]">{C.mattersHeading}</h2>
          {matters.kind === "loading" && <p className="mt-2 text-sm text-[var(--color-text-dim)]">{C.loading}</p>}
          {matters.kind === "error" && <p className="mt-2 text-sm text-[var(--color-text)]">{C.mattersUnavailable}</p>}
          {matters.kind === "list" && (matters.matters.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-text)]" data-testid="home-matters-empty">{Y.empty}</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              {matters.matters.slice(0, SHOWN).map((m, i) => (
                <li key={m.matterId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm" data-testid="home-matter-row">
                  <span>{matterLabel(i + 1)} · {papersCount(m.papers)}</span>
                  <Link href="/matter-tools" className="inline-flex min-h-6 items-center underline max-md:min-h-11">{C.openMatter}</Link>
                </li>
              ))}
            </ul>
          ))}
          {matters.kind === "list" && <p className="mt-1 text-sm"><Link href="/matter-tools" className="inline-flex min-h-6 items-center underline max-md:min-h-11">{C.allMatters}</Link></p>}
        </section>
      )}
      <section aria-labelledby="home-workflows-heading" data-testid="home-workflows">
        <h2 id="home-workflows-heading" className="text-base font-medium text-[var(--color-text)]">{C.workflowsHeading}</h2>
        <ul className="mt-2 grid gap-3 sm:grid-cols-3">
          {workflows.map((w) => (
            <li key={w.key} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
              <div className="font-medium text-[var(--color-text)]">{w.title}</div>
              <p className="mt-1 text-xs text-[var(--color-text-dim)]">{w.line}</p>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-sm"><Link href="/workflows" className="inline-flex min-h-6 items-center underline max-md:min-h-11">{C.allWorkflows}</Link></p>
      </section>
      <section aria-labelledby="home-quick-heading">
        <h2 id="home-quick-heading" className="text-base font-medium text-[var(--color-text)]">{C.quickHeading}</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="home-quick">
          {HOME_QUICK.map((l) => (<li key={l.href}><Link href={l.href} className="inline-flex min-h-6 items-center underline max-md:min-h-11">{l.label}</Link></li>))}
        </ul>
      </section>
      {isAdmin && (
        <p className="text-sm" data-testid="home-invite"><Link href="/admin/access" className="inline-flex min-h-6 items-center underline max-md:min-h-11">{C.invitePeople}</Link></p>
      )}
    </div>
  );
}
