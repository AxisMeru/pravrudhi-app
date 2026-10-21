// The film on /guide (operator, 20 Oct: Studio rebuilds the user-guide film, prabhasa-nyaya#1025; embedded with the app deploy, then on each deploy on a day the product visibly changed; prabhasa-nyaya#1026).
// ONE slot: the page renders whatever this file names. Every earlier version stays in public/films/ and in FILM_IDS (nothing is deleted). Adding a version: its files in public/films/<id>/ (film.mp4, film.webm, poster.png, captions.vtt, manifest.json), the id in FILM_IDS (copy.ts) and WEBM_FILMS (films.ts), then this file.
//
// guide-v2 (narrated, audio true) + guide-v2-silent (the sound-off / reduced-motion fallback), Studio's delivery 21 Oct (SHA256SUMS 0cdf4cb407fb, strings GUIDE_STRINGS_v2 b4c8036de535, R1 signed the words c586e4d433d0).
// SHIP CONDITION (R1, a BLOCK on EMBEDDING): its sample scene shows the 'Load a sample matter' button (app #480) and its voice says 'To try the tools without your own papers, load a sample matter.' So v2 is built in only with NEXT_PUBLIC_GUIDE_FILM_V2=1,
// set at the deploy that carries #480 live in production; without it the page shows the earlier film ('client'), unchanged. R1's staleness advice: the film shows the interim matter-note lines; Studio re-renders when "Your matters" or scanned papers ships.
import type { FilmManifest } from "./films";
import type { FilmId } from "./copy";
import clientManifest from "../../../public/films/client/manifest.json";
import guideV2Manifest from "../../../public/films/guide-v2/manifest.json";
import guideV2SilentManifest from "../../../public/films/guide-v2-silent/manifest.json";

export const GUIDE_FILM_V2 = process.env.NEXT_PUBLIC_GUIDE_FILM_V2 === "1";

/** The earlier film that the page shows while v2 is not built in. */
export const GUIDE_FILM_ID: FilmId = "client";
export const GUIDE_FILM_MANIFEST: FilmManifest = clientManifest as FilmManifest;

/** The narrated default and its silent fallback (same rule as the benchmarks film: sound on at Play with a visible Mute; the silent cut for reduced motion or a playback error). */
export const GUIDE_V2 = {
  narratedId: "guide-v2" as FilmId,
  silentId: "guide-v2-silent" as FilmId,
  narrated: guideV2Manifest as FilmManifest,
  silent: guideV2SilentManifest as FilmManifest,
};
