import { PageHeader } from "@/components/PageHeader";
import { FilmPlayer } from "@/components/films/FilmPlayer";
import { NYAYASIDDHI_CUT_HEADINGS, NYAYASIDDHI_FILM_SUBTITLE, NYAYASIDDHI_FILM_TITLE } from "@/lib/films/copy";

// The review copy of the NyayaSiddhi film's three silent cuts: poster first, muted autoplay with captions on (reduced motion keeps the poster until asked). Not linked from anywhere. Only the three silent cuts are here.
const CUTS = ["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm"] as const;

export default function BenchmarksFilmPreviewPage() {
  return (
    <div>
      <PageHeader title={NYAYASIDDHI_FILM_TITLE} subtitle={NYAYASIDDHI_FILM_SUBTITLE} />
      <div className="mx-auto max-w-4xl space-y-10 p-4 sm:p-8">
        {CUTS.map((id) => (
          <section key={id} className="space-y-3" aria-label={NYAYASIDDHI_CUT_HEADINGS[id]}>
            <h2 className="text-base font-medium text-[var(--color-text)]">{NYAYASIDDHI_CUT_HEADINGS[id]}</h2>
            <FilmPlayer id={id} autoplayMuted captionsOn />
          </section>
        ))}
      </div>
    </div>
  );
}
