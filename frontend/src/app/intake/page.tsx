"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSignedIn } from "@/components/useAssistantTier";
import { FactSelector } from "@/components/FactSelector";
import { PageHeader } from "@/components/PageHeader";
import { postIntake } from "@/lib/api";
import { intakeErrorLine } from "@/lib/intakeErrors";
import { chosenFacts, initialSelection } from "@/lib/factSelection";
import { setHandoff, setHandoffCitations } from "@/lib/handoff";
import {
  INTAKE_DUPLICATE,
  INTAKE_LIMIT_SENTENCE,
  INTAKE_RAW_FALLBACK,
  INTAKE_SIGNED_IN_ONLY,
  INTAKE_SERVED_RAW,
  citationLine,
  parseIntake,
  type IntakeView,
} from "@/lib/intake";
import { INTAKE_ENABLED } from "@/lib/intakeFlag";
import { INTAKE_CAVEATS, INTAKE_DATA_LINE, INTAKE_LEFT_OUT_DIGITS, intakeLeftOut, INTAKE_PAGE_TITLE, INTAKE_PAGE_SUBTITLE, INTAKE_PASTE_LABEL, INTAKE_RUN_BUTTON, INTAKE_UNREADABLE, INTAKE_CITATIONS_HEADING } from "@/lib/intakeCopy";

// Intake: paste text, get numbered facts tied to the words they came from and the citations found, choose up to 8 facts, and send them to Screening. The words are R1's
// (lib/intake.ts, lib/factSelectionCopy.ts) or proposed in lib/intakeCopy.ts. Offered only when NEXT_PUBLIC_INTAKE=1; otherwise this route goes back to Workflows.
export default function IntakePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<IntakeView | null>(null);
  const [selected, setSelected] = useState<readonly number[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const signedIn = useSignedIn();

  useEffect(() => {
    if (!INTAKE_ENABLED) router.replace("/workflows");
  }, [router]);
  if (!INTAKE_ENABLED) return null;

  async function run() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setView(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const v = parseIntake(await postIntake(text, ac.signal));
      if (v === null) {
        setError(INTAKE_UNREADABLE);
      } else {
        setView(v);
        setSelected(initialSelection(v.facts.length));
      }
    } catch (e) {
      setError(intakeErrorLine(e));
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title={INTAKE_PAGE_TITLE} subtitle={INTAKE_PAGE_SUBTITLE} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8" data-testid="intake">
        <section className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {/* R1 (15 Oct, #247): a signed-out visitor is told up front, above the paste box, in R1's existing sentence. */}
          {signedIn === false && <p className="text-sm text-[var(--color-text)]" role="status" data-testid="intake-signed-in-only-upfront">{INTAKE_SIGNED_IN_ONLY}</p>}
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="intake-text">{INTAKE_PASTE_LABEL}</label>
          <p className="text-xs text-[var(--color-text-dim)]" data-testid="intake-data-line">{INTAKE_DATA_LINE}</p>
          <textarea
            id="intake-text"
            className="min-h-[160px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <ul className="space-y-1 text-xs text-[var(--color-text-dim)]" data-testid="intake-caveats">
            {INTAKE_CAVEATS.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm" data-testid="intake-run" disabled={loading || !text.trim()} onClick={run}>
              {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : INTAKE_RUN_BUTTON}
            </button>
          </div>
          {error && <p className="text-sm text-[var(--color-text)]" role="status" data-testid="intake-error">{error}</p>}
        </section>

        {view && (
          <>
            {view.cleanStatus === "served_raw" && <p className="text-sm text-[var(--color-text)]" data-testid="intake-served-raw">{INTAKE_SERVED_RAW}</p>}
            <FactSelector
              facts={view.facts.map((f) => f.text)}
              selected={selected}
              onChange={setSelected}
              onScreen={() => {
                setHandoff(chosenFacts(view.facts.map((f) => f.text), selected).map((c) => c.text));
                setHandoffCitations(view.citations);
                router.push("/screening");
              }}
            />
            {view.leftOut > 0 && (
              <div className="space-y-1 text-sm text-[var(--color-text)]" data-testid="intake-left-out">
                <p>{intakeLeftOut(view.leftOut)}</p>
                {view.leftOutHasDigit && <p data-testid="intake-left-out-digits">{INTAKE_LEFT_OUT_DIGITS}</p>}
              </div>
            )}
            {(view.facts.some((f) => f.status === "raw_fallback") || view.duplicates > 0) && (
              <ul className="space-y-1 text-xs text-[var(--color-text-dim)]" data-testid="intake-fact-notes">
                {view.facts.map((f, i) => f.status === "raw_fallback" && <li key={f.id}>F{i + 1}: {INTAKE_RAW_FALLBACK}</li>)}
                {view.duplicates > 0 && <li>{INTAKE_DUPLICATE}</li>}
              </ul>
            )}
            {view.citations.length > 0 && (
              <section className="space-y-2" data-testid="intake-citations">
                <h2 className="text-base font-medium text-[var(--color-text)]">{INTAKE_CITATIONS_HEADING}</h2>
                <ul className="space-y-2 text-sm">
                  {view.citations.map((c, i) => (
                    <li key={i} className="rounded-md border border-[var(--color-border)] p-2">
                      <span className="text-[var(--color-text)]">{c.text}</span>
                      <span className="mt-1 block text-xs text-[var(--color-text-dim)]" data-testid="citation-line">{citationLine(c.verifierStatus)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-xs text-[var(--color-text-dim)]" data-testid="intake-limit">{INTAKE_LIMIT_SENTENCE}</p>
          </>
        )}
      </div>
    </div>
  );
}
