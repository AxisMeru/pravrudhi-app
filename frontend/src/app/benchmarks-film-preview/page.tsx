import { PageHeader } from "@/components/PageHeader";
import { FilmPlayer } from "@/components/films/FilmPlayer";
import { loadNyayasiddhiManifest } from "@/lib/films/nyayasiddhiFilms";
import { NYAYASIDDHI_CUT_HEADINGS, NYAYASIDDHI_FILM_SUBTITLE, NYAYASIDDHI_FILM_TITLE, NYAYASIDDHI_SILENT_LABEL, NYAYASIDDHI_VOICE_HEADINGS, NYAYASIDDHI_VOICE_PREVIEW_LABEL } from "@/lib/films/copy";

// The review copy of the NyayaSiddhi film: the three silent cuts (poster first, muted autoplay, captions OFF until asked; reduced motion keeps the poster until asked), then the two narrated previews for the operator's voice review (poster first, captions off until asked, the sound button turns the voice on in one click). Not linked from anywhere.
const CUTS = ["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm"] as const;
const VOICE = ["nyayasiddhi-narrated", "nyayasiddhi-firm-narrated"] as const;

export default async function BenchmarksFilmPreviewPage() {
  // the manifests are loaded here (dynamic import), on this route only, and handed to the player as data
  const manifests = Object.fromEntries(await Promise.all([...CUTS, ...VOICE].map(async (id) => [id, await loadNyayasiddhiManifest(id)] as const)));
  return (
    <div>
      <PageHeader title={NYAYASIDDHI_FILM_TITLE} subtitle={NYAYASIDDHI_FILM_SUBTITLE} />
      <div className="mx-auto max-w-4xl space-y-10 p-4 sm:p-8">
        {CUTS.map((id) => (
          <section key={id} className="space-y-3" aria-label={NYAYASIDDHI_CUT_HEADINGS[id]}>
            <h2 className="text-base font-medium text-[var(--color-text)]">{NYAYASIDDHI_CUT_HEADINGS[id]}</h2>
            <p className="text-sm text-[var(--color-text)]" data-testid="silent-label">{NYAYASIDDHI_SILENT_LABEL}</p>
            <FilmPlayer id={id} manifest={manifests[id]} autoplayMuted />
          </section>
        ))}
        {VOICE.map((id) => (
          <section key={id} className="space-y-3" aria-label={`${NYAYASIDDHI_VOICE_HEADINGS[id]}: ${NYAYASIDDHI_VOICE_PREVIEW_LABEL}`} data-testid={`voice-${id}`}>
            <h2 className="text-base font-medium text-[var(--color-text)]">{NYAYASIDDHI_VOICE_HEADINGS[id]}</h2>
            <p className="text-sm text-[var(--color-text)]" data-testid="voice-preview-label">{NYAYASIDDHI_VOICE_PREVIEW_LABEL}</p>
            <FilmPlayer id={id} manifest={manifests[id]} />
          </section>
        ))}
      </div>
    </div>
  );
}
