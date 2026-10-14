"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** A textarea that grows with its text (up to `maxRows` lines, then scrolls), so no fact is clipped mid-sentence (P5). Same props as a textarea. */
export function AutoGrowTextarea({ maxRows = 12, className = "", value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { maxRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 20;
    const chrome = el.offsetHeight - el.clientHeight; // borders (box-sizing: border-box)
    const max = line * maxRows + 16 + chrome;
    const want = el.scrollHeight + chrome;
    el.style.height = `${Math.min(want, max)}px`;
    el.style.overflowY = want > max ? "auto" : "hidden";
  }, [value, maxRows]);
  return <textarea ref={ref} rows={1} className={className} value={value} {...rest} />;
}
