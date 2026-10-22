"use client";

import Link from "next/link";

import { APP_SHA, shortSha } from "@/lib/buildInfo";
import { FOOTER_COPY } from "@/lib/aboutCopy";
import { useEngineRead } from "@/lib/engineHealth";

/** The version line at the end of every page (app#519): "App <sha> · Engine <version>". The engine version is /api/health's, read on load; while it is being read the line shows the app alone, and a failed read says so (never a stale number). */
export function SiteFooter() {
  const read = useEngineRead();
  const engine = read.kind === "ok" ? ` · ${FOOTER_COPY.engine} ${read.version}` : read.kind === "down" ? ` · ${FOOTER_COPY.engine} ${FOOTER_COPY.engineUnavailable}` : "";
  return (
    <footer className="px-5 py-4 text-xs text-[var(--color-text-dim)] print:hidden" data-testid="site-footer">
      <Link href="/about" className="underline" data-testid="site-footer-link">
        {FOOTER_COPY.app} {shortSha(APP_SHA)}{engine}
      </Link>
    </footer>
  );
}
