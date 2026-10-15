// The motion films (#251). Every word the pages add around a film is here, for R1 to read; the film's own text (scene names and descriptions) comes from its manifest, written by scripts/render-films.mjs
// from the film itself. PROPOSED wording: R1 to confirm or replace each line. Nothing here is a claim about results.
export const FILM_IDS = ["client", "technical"] as const;
export type FilmId = (typeof FILM_IDS)[number];

/** Where the rendered files live (public/films/<id>/): the page adds the build's base path. */
export const FILM_DIR = "/films";

export const FILM_PLAY_BUTTON = "Play the film";
export const FILM_TRANSCRIPT_HEADING = "What the film shows";
export const FILM_SILENT_NOTE = "The film has no sound; the captions and the list below say what it shows.";
export const FILM_VIDEO_UNSUPPORTED = "Your browser cannot play this video.";

/** The guide's section, and the links to the films. */
export const GUIDE_FILM_HEADING = "Watch the film";
export const DEMO_FILM_LINK = "Watch the technical film";
export const GUIDE_FILM_LINK = "Watch the short film in the guide";
export const TECHNICAL_FILM_TITLE = "Technical film"; // also the page title (lib/pageTitles.ts)
export const TECHNICAL_FILM_SUBTITLE = "How a screening is built and checked, as a short silent film.";
