import { NYAYASIDDHI_BLURB, NYAYASIDDHI_LINK_TEXT, NYAYASIDDHI_URL } from "@/lib/benchmarks";

/** The open development benchmark: a link and a short blurb under it. No figure; the strings are fixed and pass the vendored lint. */
export function NyayaSiddhiLink({ className = "" }: { className?: string }) {
  return (
    <div className={className} data-testid="nyayasiddhi">
      <a href={NYAYASIDDHI_URL} target="_blank" rel="noopener noreferrer" className="text-sm underline" data-testid="nyayasiddhi-link">
        {NYAYASIDDHI_LINK_TEXT}
      </a>
      <p className="text-xs text-[var(--color-text-dim)]" data-testid="nyayasiddhi-blurb">
        {NYAYASIDDHI_BLURB}
      </p>
    </div>
  );
}
