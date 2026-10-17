import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { NS_SUBMIT as T, NS_SUBMIT_LINKS as L } from "@/lib/nyayasiddhiSubmit";

const EXT = "inline-flex min-h-6 items-center text-[var(--color-accent)] underline max-md:min-h-11";
const CARD = "space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const P = "text-sm text-[var(--color-text)]";

// How to submit a system to NyayaSiddhi (app#429): static, every sentence R1's (lib/nyayasiddhiSubmit.ts), links only to public files of the Hugging Face dataset. No upload here.
export default function SubmitPage() {
  const steps = [T.step1, T.step2, T.step3, T.step4, T.step5, T.step6];
  return (
    <div>
      <PageHeader title={T.heading} subtitle={T.intro} />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8" data-testid="ns-submit">
        <section className={CARD} aria-label={T.heading} data-testid="ns-submit-status">
          <p className={P}>{T.status_line}</p>
          <p className={P}>{T.hidden_split}</p>
          <p className={P}>{T.not_a_ranking}</p>
          <p className={P}>{T.no_outside_yet}</p>
        </section>
        <ol className="space-y-3" data-testid="ns-submit-steps">
          {steps.map((s, i) => (
            <li key={i} className={`${CARD} ${P}`}>{s}</li>
          ))}
        </ol>
        <p className={P} data-testid="ns-submit-after">{T.after_submit}</p>
        <p className={P} data-testid="ns-submit-oracle">{T.oracle_note}</p>
        <section className={CARD} aria-labelledby="ns-template-heading" data-testid="ns-submit-template">
          <h2 id="ns-template-heading" className="text-base font-medium text-[var(--color-text)]">{T.template_heading}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
            {T.templateFields.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </section>
        <section className={CARD} aria-labelledby="ns-checker-heading" data-testid="ns-submit-checker">
          <h2 id="ns-checker-heading" className="text-base font-medium text-[var(--color-text)]">{T.checker_heading}</h2>
          <p className={P}>{T.checker_text}</p>
          <p><a href={L.checker} target="_blank" rel="noopener noreferrer" className={EXT} data-testid="ns-link-checker">{T.link_checker}</a></p>
        </section>
        <section className={CARD} aria-labelledby="ns-limits-heading" data-testid="ns-submit-limits">
          <h2 id="ns-limits-heading" className="text-base font-medium text-[var(--color-text)]">{T.limits_heading}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
            {[T.limit1, T.limit2, T.limit3, T.limit4].map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>
        <p className={P} data-testid="ns-submit-no-upload">{T.no_upload}</p>
        <p><a href={L.dataset} target="_blank" rel="noopener noreferrer" className={EXT} data-testid="ns-link-dataset">{T.link_dataset}</a></p>
        <p><Link href="/benchmarks" className={EXT} data-testid="ns-link-back">{T.link_back}</Link></p>
      </div>
    </div>
  );
}
