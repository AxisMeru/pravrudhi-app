"use client";

import Link from "next/link";
import { X } from "lucide-react";

import {
  START_PANEL_CLOSE_LABEL, START_PANEL_DATA_LINK, START_PANEL_EXAMPLE_BUTTON, START_PANEL_HEADING, START_PANEL_LINE, START_PANEL_OWN_BUTTON, START_PANEL_STEPS,
} from "@/lib/screening/copy";

/** The first-run panel of the Matter workspace (canvas Start): shown only while no facts are entered and no result is shown, and until the visitor closes it (remembered in this browser only). */
export function StartPanel({ onExample, onOwn, onClose }: { onExample: () => void; onOwn: () => void; onClose: () => void }) {
  return (
    <section className="relative flex flex-col gap-4 rounded-xl bg-[var(--color-hero)] p-5 text-[var(--color-on-hero)] print:hidden" aria-labelledby="start-panel-heading" data-testid="start-panel">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-md border border-[var(--color-on-hero-dim)] text-[var(--color-on-hero)]"
        aria-label={START_PANEL_CLOSE_LABEL}
        data-testid="start-panel-close"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <h2 id="start-panel-heading" className="pr-14 font-serif text-xl font-semibold">{START_PANEL_HEADING}</h2>
      <p className="max-w-3xl text-sm text-[var(--color-on-hero-dim)]">{START_PANEL_LINE}</p>
      <ol className="grid gap-3 sm:grid-cols-3" data-testid="start-panel-steps">
        {START_PANEL_STEPS.map((s) => (
          <li key={s} className="rounded-lg border border-[var(--color-on-hero-dim)]/40 px-4 py-3 text-sm">{s}</li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExample} className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-on-hero)] px-4 text-sm font-semibold text-[var(--color-hero)]" data-testid="start-panel-example">
          {START_PANEL_EXAMPLE_BUTTON}
        </button>
        <button type="button" onClick={onOwn} className="inline-flex min-h-11 items-center rounded-md border border-[var(--color-on-hero)] px-4 text-sm text-[var(--color-on-hero)]" data-testid="start-panel-own">
          {START_PANEL_OWN_BUTTON}
        </button>
        <Link href="/data-handling" className="inline-flex min-h-6 items-center text-sm text-[var(--color-on-hero)] underline" data-testid="start-panel-data-link">{START_PANEL_DATA_LINK}</Link>
      </div>
    </section>
  );
}
