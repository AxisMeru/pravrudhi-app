import { PageHeader } from "@/components/PageHeader";
import { FilmPlayer } from "@/components/films/FilmPlayer";
import { NYAYASIDDHI_FILM_SUBTITLE, NYAYASIDDHI_FILM_TITLE } from "@/lib/films/copy";

// The review copy of the NyayaSiddhi film: poster first, muted autoplay with captions on (reduced motion keeps the poster until asked). Not linked from anywhere.
export default function BenchmarksFilmPreviewPage() {
  return (
    <div>
      <PageHeader title={NYAYASIDDHI_FILM_TITLE} subtitle={NYAYASIDDHI_FILM_SUBTITLE} />
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <FilmPlayer id="nyayasiddhi" autoplayMuted captionsOn />
      </div>
    </div>
  );
}
