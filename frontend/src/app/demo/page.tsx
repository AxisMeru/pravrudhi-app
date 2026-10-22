"use client";

import Link from "next/link";
import { useEffect } from "react";

// The old "How it works" page (app#535): it is a section of the user guide now. Opening this address goes straight to it; the link is the fallback for a browser that does not run the redirect.
export default function DemoPage() {
  useEffect(() => { window.location.replace("/guide#how-it-works"); }, []);
  return (
    <div className="p-8 text-sm text-[var(--color-text)]" data-testid="demo-moved">
      <p>How it works is now part of the user guide.</p>
      <Link href="/guide#how-it-works" className="mt-2 inline-flex min-h-6 items-center underline" data-testid="demo-moved-link">Open How it works in the user guide</Link>
    </div>
  );
}
