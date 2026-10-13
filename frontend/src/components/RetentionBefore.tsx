import Link from "next/link";

import { PRE_SUBMIT_LINK_TEXT, PRE_SUBMIT_RETENTION } from "@/lib/surfaceCopy";

/** The before-you-submit retention notice; its closing "Data handling" links to the page. The text content equals PRE_SUBMIT_RETENTION exactly. */
export function RetentionBefore() {
  const cut = PRE_SUBMIT_RETENTION.lastIndexOf(PRE_SUBMIT_LINK_TEXT);
  return (
    <p className="text-xs text-[var(--color-text-dim)]" data-testid="retention-before">
      {PRE_SUBMIT_RETENTION.slice(0, cut)}
      <Link href="/data-handling" className="text-[var(--color-accent)] underline">{PRE_SUBMIT_LINK_TEXT}</Link>
      {PRE_SUBMIT_RETENTION.slice(cut + PRE_SUBMIT_LINK_TEXT.length)}
    </p>
  );
}
