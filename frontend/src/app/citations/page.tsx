"use client";

import { Loader2, SearchCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { CitationsPanel } from "@/components/citations/CitationsPanel";
import { useSignedOut } from "@/components/citations/useSignedOut";
import { PageHeader } from "@/components/PageHeader";
import { CITATION_RETENTION } from "@/lib/surfaceCopy";
import { verifyCitation } from "@/lib/api";
import { CITATION_NAV_ENABLED, CITATION_NOT_OFFERED_LINK, CITATION_NOT_OFFERED_TEXT } from "@/lib/citationNav";
import { CITATION_EXISTENCE_ONLY, COVERAGE_LIMITS_TEXT, EXISTENCE_LIMITS, EXISTENCE_SUBTITLE, RETENTION_EXISTENCE, SIGNED_OUT_BEFORE_TEXT } from "@/lib/citationExistence";
import {
  CITATION_MAX,
  CITATION_PLACEHOLDER,
  CITATION_CHECK_TITLE,
  QUOTE_MAX,
  checkInputs,
  statusLabel,
  classifyVerifyError,
  verifyView,
  type VerifyView,
} from "@/lib/citationCheck";

// The citation check (#539): one citation and the quote to look for. The status the engine answers is shown verbatim with its note; the page
// is labelled as a preview until the accuracy study reports, and says what a status is not (it checks existence and the quote, not
// whether the case supports a point).
export default function CitationsPage() {
  // #128 D2: while the check is not served in the hosted deployment (NEXT_PUBLIC_CITATION_NAV off) the page has NO form, only the signed "index not available" sentence: it says the check is not served, so it must not invite one.
  const served = CITATION_NAV_ENABLED;
  const [citation, setCitation] = useState("");
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<VerifyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const signedOut = useSignedOut(served && CITATION_EXISTENCE_ONLY);

  async function submit() {
    const check = checkInputs(citation, CITATION_EXISTENCE_ONLY ? null : quote);
    if (!check.ok) {
      setError(check.message);
      setView(null);
      return;
    }
    setLoading(true);
    setError(null);
    setView(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setView(verifyView(await verifyCitation(citation, CITATION_EXISTENCE_ONLY ? null : quote, ac.signal), undefined, undefined, citation));
    } catch (e) {
      setError(classifyVerifyError(e).message);
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  if (!served) {
    return (
      <div>
        <PageHeader title={CITATION_CHECK_TITLE} subtitle="" />
        <div className="mx-auto max-w-3xl space-y-3 p-4 sm:p-8">
          <p className="text-sm text-[var(--color-text)]" data-testid="citation-not-offered">{CITATION_NOT_OFFERED_TEXT}</p>
          <Link href="/screening" className="inline-flex min-h-6 items-center text-sm text-[var(--color-text-dim)] underline" data-testid="citation-not-offered-link">{CITATION_NOT_OFFERED_LINK}</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={CITATION_CHECK_TITLE} subtitle={CITATION_EXISTENCE_ONLY ? EXISTENCE_SUBTITLE : "Look up one citation and check that a quote appears in its text."} />
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="citation-limits">
          {CITATION_EXISTENCE_ONLY ? EXISTENCE_LIMITS : (
            <>
          The check looks for the case in our index and for the quote in its text, word for word apart from line breaks, quote marks, dashes and
          spacing. It does not say whether the case supports a point. If the case is not found in our index, that does not show whether the citation is real, because the index does not hold every judgment. This check is not yet served in the hosted deployment.
            </>
          )}
        </p>
        {CITATION_EXISTENCE_ONLY && (
          <p className="text-sm text-[var(--color-text-dim)]" data-testid="citation-coverage-limits">{COVERAGE_LIMITS_TEXT}</p>
        )}
        <p className="text-xs text-[var(--color-text-dim)]" data-testid="citation-retention">{CITATION_EXISTENCE_ONLY ? RETENTION_EXISTENCE : CITATION_RETENTION}</p>
        {CITATION_EXISTENCE_ONLY && signedOut && (
          <p className="text-sm text-[var(--color-text)]" data-testid="citation-signed-out">{SIGNED_OUT_BEFORE_TEXT}</p>
        )}
        {CITATION_EXISTENCE_ONLY ? (
          /* #263: a pasted LIST, like the Screening panel (same component, same limit text, the line count under the box); nothing is cut without being said. */
          <CitationsPanel embedded />
        ) : (
        <>
        <label className="block text-sm text-[var(--color-text)]">
          Citation (one)
          <input
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            maxLength={CITATION_MAX}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
            placeholder={CITATION_PLACEHOLDER}
          />
        </label>
        {!CITATION_EXISTENCE_ONLY && (
        <label className="block text-sm text-[var(--color-text)]">
          Quote to look for
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            maxLength={QUOTE_MAX}
            rows={5}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
          />
        </label>
        )}
        <button
          type="button"
          onClick={() => { if (!loading) void submit(); }}
          aria-disabled={loading} /* #260: keeps keyboard focus on the button while the check runs */
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-accent)] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <SearchCheck size={14} />}
          {loading ? "Checking…" : "Check"}
        </button>
        {error && (
          <p className="text-sm text-[var(--color-danger)]" role="alert" data-testid="citation-error">
            {error}
          </p>
        )}
        <div role="status" data-testid="citation-live">
        {view && (
          <section className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid="citation-result">
            <div className="text-sm text-[var(--color-text-dim)]">Result</div>
            <div className="font-mono text-base text-[var(--color-text)]" data-testid="citation-status">
              {statusLabel(view.status) || "(no status)"}
            </div>
            {view.product && (
              <div className="space-y-1" data-testid="citation-product-status">
                <p className="text-sm text-[var(--color-text)]" data-testid="citation-product-label">
                  {view.product.label}
                </p>
              </div>
            )}
            {view.note && (
              <p className="text-sm text-[var(--color-text)]" data-testid="citation-note">
                {view.note}
              </p>
            )}
          </section>
        )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
