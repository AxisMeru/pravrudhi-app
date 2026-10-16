// The motion films (#251). Every word the pages add around a film is here, for R1 to read; the film's own text (scene names and descriptions) comes from its manifest, written by scripts/render-films.mjs
// from the film itself. R1 confirmed these nine lines byte-exact (15 Oct, #273). Nothing here is a claim about results.
export const FILM_IDS = ["client", "technical", "nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm", "nyayasiddhi-narrated", "nyayasiddhi-firm-narrated"] as const;
export type FilmId = (typeof FILM_IDS)[number];

/** Where the rendered files live (public/films/<id>/): the page adds the build's base path. */
export const FILM_DIR = "/films";

export const FILM_PLAY_BUTTON = "Play the film";
export const FILM_TRANSCRIPT_HEADING = "What the film shows";
export const FILM_NARRATED_NOTE = "The film is narrated; the captions carry the narration, and the list below sums up each scene.";
/** PROPOSED for R1 (NyayaSiddhi film, 16 Oct): the note under a silent film (its manifest says audio false); it replaces the narrated note and the synthetic-voice line. */
export const FILM_SILENT_NOTE = "The film is silent; the captions carry its words, and the list below sums up each scene.";
export const FILM_SYNTHETIC_VOICE = "The narration is a synthetic voice.";
// New controls (Web, 15 Oct; proposed wording, for R1 to confirm when built). The film starts muted so it can start anywhere; the visible button turns the narration on.
export const FILM_SOUND_ON = "Turn on sound";
export const FILM_SOUND_OFF = "Turn off sound";
export const FILM_CAPTIONS_SHOW = "Show captions";
export const FILM_CAPTIONS_HIDE = "Hide captions";
export const FILM_DOWNLOAD_LINK = "Download the film";
export const FILM_VIDEO_UNSUPPORTED = "Your browser cannot play this video.";

/** The guide's section, and the links to the films. */
export const GUIDE_FILM_HEADING = "Watch the film";
export const DEMO_FILM_LINK = "Watch the technical film";
export const GUIDE_FILM_LINK = "Watch the short film in the guide";
export const TECHNICAL_FILM_TITLE = "Technical film"; // also the page title (lib/pageTitles.ts)
export const TECHNICAL_FILM_SUBTITLE = "How a screening is built and checked, as a short narrated film.";

/** PROPOSED for R1: the unlisted review page of the NyayaSiddhi film (/benchmarks-film-preview): noindex, no link to it anywhere on the site. */
export const NYAYASIDDHI_FILM_TITLE = "NyayaSiddhi film: review copy";
export const NYAYASIDDHI_FILM_SUBTITLE = "A review copy of the film for the NyayaSiddhi benchmark. This page is not linked from the site.";
/** PROPOSED for R1: the three cuts' headings on the review page only (review labels, not public copy). */
export const NYAYASIDDHI_CUT_HEADINGS = { "nyayasiddhi": "Cut A: the main film", "nyayasiddhi-loop": "Cut D: the short loop", "nyayasiddhi-firm": "Cut C: the cut for law firms" } as const;

/** PROPOSED for R1 (the operator's voice gate, 16 Oct): the label on each narrated preview, on the review page only. The narrated cuts are reachable only by this unlisted URL. */
export const NYAYASIDDHI_VOICE_PREVIEW_LABEL = "Preview for voice review";
export const NYAYASIDDHI_VOICE_HEADINGS = { "nyayasiddhi-narrated": "Cut A, narrated", "nyayasiddhi-firm-narrated": "Cut C, narrated" } as const;
