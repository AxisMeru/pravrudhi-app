"use client";

import { Loader2, SearchCheck } from "lucide-react";
import { useRef, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { verifyCitation } from "@/lib/api";
import {
  CITATION_MAX,
  CITATION_CHECK_TITLE,
  PREVIEW_LABEL,
  QUOTE_MAX,
  checkInputs,
  classifyVerifyError,
  verifyView,
  type VerifyView,
} from "@/lib/citationCheck";

// The citation check (#539): one citation and the quote to look for. The status the engine answers is shown verbatim with its note; the page
// is labelled as a preview until the accuracy study reports, and says what a status is not (it checks existence and the quote, not
// whether the case supports a point).
export default function CitationsPage() {
  const [citation, setCitation] = useState("");
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<VerifyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function submit() {
    const check = checkInputs(citation, quote);
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
      setView(verifyView(await verifyCitation(citation, quote, ac.signal)));
    } catch (e) {
      setError(classifyVerifyError(e).message);
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title={CITATION_CHECK_TITLE} subtitle="Look up one citation and check that a quote appears in its text." />
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <p className="w-fit rounded-md border border-amber-500/40 px-2 py-0.5 text-xs text-amber-300" data-testid="citation-preview-label">
          {PREVIEW_LABEL}
        </p>
        <p className="text-sm text-[var(--color-text-dim)]" data-testid="citation-limits">
          The check looks for the case in our index and for the quote in its text, word for word apart from line breaks, quote marks, dashes and
          spacing. It does not say whether the case supports a point. A result of NOT_IN_INDEX means the case was not found in our index; that does
          not show whether the citation is real, because the index does not hold every judgment.
        </p>
        <label className="block text-sm text-[var(--color-text)]">
          Citation (one)
          <input
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            maxLength={CITATION_MAX}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
            placeholder="(2020) 3 SCC 456"
          />
        </label>
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
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <SearchCheck size={14} />}
          {loading ? "Checking…" : "Check"}
        </button>
        {error && (
          <p className="text-sm text-red-400" role="alert" data-testid="citation-error">
            {error}
          </p>
        )}
        {view && (
          <section className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid="citation-result">
            <div className="text-sm text-[var(--color-text-dim)]">Result</div>
            <div className="font-mono text-base text-[var(--color-text)]" data-testid="citation-status">
              {view.status || "(no status)"}
            </div>
            {view.product && (
              <div className="space-y-1" data-testid="citation-product-status">
                <p className="text-sm text-[var(--color-text)]" data-testid="citation-product-label">
                  {view.product.label}
                </p>
                {view.product.preview && (
                  <span className="inline-block rounded-md border border-amber-500/40 px-2 py-0.5 text-xs text-amber-300" data-testid="citation-product-preview">
                    preview
                  </span>
                )}
              </div>
            )}
            {!view.known && (
              <p className="text-xs text-[var(--color-text-dim)]" data-testid="citation-unknown">
                The engine sent a status this build does not know; it is shown as sent.
              </p>
            )}
            {view.note && (
              <p className="text-sm text-[var(--color-text)]" data-testid="citation-note">
                {view.note}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
