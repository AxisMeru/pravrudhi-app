"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EXPORT_GROUP_LABEL, EXPORT_LABELS, MEMO_DOCX_LABEL } from "@/lib/screening/copy";

/**
 * "Download the memo" as a menu button (M2b): it opens a list holding Word (.docx) first and Markdown (.md) (by position only: no "default" tag). It is a disclosure, not an ARIA menu: the items are
 * ordinary buttons in the page's tab order, in the flow of the page (not floating), so the list is on the screen and in the page's own screenshot. Escape and a click elsewhere close it and put focus back
 * on the button; choosing an item closes it too. "Print / save as PDF" and the run record stay beside it, as signed (they are not downloads of the memo from this menu).
 */
export function MemoMenu({ onDocx, onMarkdown }: { onDocx: () => void; onMarkdown: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);
  const choose = (go: () => void) => () => { go(); setOpen(false); button.current?.focus(); };
  return (
    <div ref={root} className="flex flex-col items-start gap-2" data-testid="memo-group">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="memo-menu-list"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-8 items-center gap-2 rounded-md border border-[var(--color-control-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] max-md:min-h-11"
        data-testid="memo-menu-button"
      >
        {EXPORT_GROUP_LABEL}
        <ChevronDown size={14} aria-hidden="true" className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <ul id="memo-menu-list" className="flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1" data-testid="memo-menu-list">
          <li>
            <button type="button" className="inline-flex min-h-8 w-full items-center rounded px-3 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-hover)] max-md:min-h-11" data-testid="memo-docx" onClick={choose(onDocx)}>{MEMO_DOCX_LABEL}</button>
          </li>
          <li>
            <button type="button" className="inline-flex min-h-8 w-full items-center rounded px-3 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-hover)] max-md:min-h-11" data-testid="memo-md" onClick={choose(onMarkdown)}>{EXPORT_LABELS.memo}</button>
          </li>
        </ul>
      )}
    </div>
  );
}
