// The motion films (#251). Every word the pages add around a film is here, for R1 to read; the film's own text (scene names and descriptions) comes from its manifest, written by scripts/render-films.mjs
// from the film itself. R1 confirmed these nine lines byte-exact (15 Oct, #273). Nothing here is a claim about results.
export const FILM_IDS = ["client", "technical", "nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm", "nyayasiddhi-narrated", "nyayasiddhi-firm-narrated", "nyayasiddhi-explainer", "nyayasiddhi-explainer-silent"] as const;
export type FilmId = (typeof FILM_IDS)[number];

/** Where the rendered files live (public/films/<id>/): the page adds the build's base path. */
export const FILM_DIR = "/films";

export const FILM_PLAY_BUTTON = "Play the film";
export const FILM_TRANSCRIPT_HEADING = "What the film shows";
export const FILM_NARRATED_NOTE = "The film is narrated; the captions carry the narration, and the list below sums up each scene.";
/** PROPOSED for R1 (NyayaSiddhi film, 16 Oct): the note under a silent film (its manifest says audio false); it replaces the narrated note and the synthetic-voice line. */
export const FILM_SILENT_NOTE = "The film is silent; the captions name each scene, and the list below sums up each scene.";
export const FILM_SYNTHETIC_VOICE = "The narration is a synthetic voice.";
/** R1 (17 Oct, #417), layout B only: under the scene list of a film whose scenes still call the page "Matter workspace" (the recorded frames; the scene text and the film files stay frozen). */
export const FILM_EARLIER_LAYOUT_NOTE = "The film was recorded on the earlier layout, where this page was called Matter workspace.";
// New controls (Web, 15 Oct; proposed wording, for R1 to confirm when built). The film starts muted so it can start anywhere; the visible button turns the narration on.
export const FILM_SOUND_ON = "Turn on sound";
export const FILM_SOUND_OFF = "Turn off sound";
/** R1 (20 Oct, FILM_MUTE_WORDS_R1_2026-10-20.md sha12 7ed782e9f2b3), narrated-default card only: sound starts at Play; the visible button mutes it. Pinned by hash in nyayasiddhiFilm.spec.ts. */
export const FILM_MUTE = "Mute";
export const FILM_UNMUTE = "Unmute";
export const FILM_MUTE_ARIA = "Mute the narration";
export const FILM_UNMUTE_ARIA = "Unmute the narration";
export const FILM_CAPTIONS_SHOW = "Show captions";
export const FILM_CAPTIONS_HIDE = "Hide captions";
export const FILM_DOWNLOAD_LINK = "Download the film";
/** The film on the Benchmarks page (R1, 16 Oct; strings hash 9f41ebf6cbd5): its heading, the narrated cut's download link (labelled by what it is) and the poster's alt text (the poster only). */
export const BENCHMARKS_FILM_HEADING = "NyayaSiddhi film";
export const FILM_DOWNLOAD_NARRATED = "Download the narrated film";
export const BENCHMARKS_FILM_POSTER_ALT = "Poster of the NyayaSiddhi film";
export const FILM_VIDEO_UNSUPPORTED = "Your browser cannot play this video.";

/** The guide's section, and the links to the films. */
export const GUIDE_FILM_HEADING = "Watch the film";
export const DEMO_FILM_LINK = "Watch the technical film";
export const GUIDE_FILM_LINK = "Watch the short film in the guide";
export const TECHNICAL_FILM_TITLE = "Technical film"; // also the page title (lib/pageTitles.ts)
export const TECHNICAL_FILM_SUBTITLE = "How a screening is built and checked, as a short narrated film.";

