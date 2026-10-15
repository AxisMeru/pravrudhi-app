import { PageHeader } from "@/components/PageHeader";
import { FilmPlayer } from "@/components/films/FilmPlayer";
import { TECHNICAL_FILM_SUBTITLE, TECHNICAL_FILM_TITLE } from "@/lib/films/copy";

// The technical film (#254): a silent film, rendered to video by scripts/render-films.mjs; the browser's own <video> plays it.
export default function TechnicalFilmPage() {
  return (
    <div>
      <PageHeader title={TECHNICAL_FILM_TITLE} subtitle={TECHNICAL_FILM_SUBTITLE} />
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <FilmPlayer id="technical" />
      </div>
    </div>
  );
}
