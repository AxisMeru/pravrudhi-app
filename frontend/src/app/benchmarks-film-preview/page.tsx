import { PageHeader } from "@/components/PageHeader";
import { FilmPlayer } from "@/components/films/FilmPlayer";
import { NYAYASIDDHI_CUT_HEADINGS, NYAYASIDDHI_FILM_SUBTITLE, NYAYASIDDHI_FILM_TITLE, NYAYASIDDHI_VOICE_HEADINGS, NYAYASIDDHI_VOICE_PREVIEW_LABEL } from "@/lib/films/copy";

// The review copy of the NyayaSiddhi film: the three silent cuts (poster first, muted autoplay, captions on; reduced motion keeps the poster until asked), then the two narrated previews for the operator's voice review (poster first, captions on, the sound button turns the voice on). Not linked from anywhere.
const CUTS = ["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm"] as const;
const VOICE = ["nyayasiddhi-narrated", "nyayasiddhi-firm-narrated"] as const;

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
        {VOICE.map((id) => (
          <section key={id} className="space-y-3" aria-label={`${NYAYASIDDHI_VOICE_HEADINGS[id]}: ${NYAYASIDDHI_VOICE_PREVIEW_LABEL}`} data-testid={`voice-${id}`}>
            <h2 className="text-base font-medium text-[var(--color-text)]">{NYAYASIDDHI_VOICE_HEADINGS[id]}</h2>
            <p className="text-sm text-[var(--color-text)]" data-testid="voice-preview-label">{NYAYASIDDHI_VOICE_PREVIEW_LABEL}</p>
            <FilmPlayer id={id} captionsOn />
          </section>
        ))}
      </div>
    </div>
  );
}
