// The film on /guide (operator, 20 Oct: Studio rebuilds the user-guide film, prabhasa-nyaya#1025; embedded with the app deploy, d47 at the latest, then on each deploy on a day the product visibly changed; prabhasa-nyaya#1026).
// ONE slot: the page renders whatever this file names. Every earlier version stays in public/films/ and in FILM_IDS (nothing is deleted); a new version is: its five files in public/films/<id>/ (film.mp4, film.webm, poster.png, captions.vtt, manifest.json),
// the id added to FILM_IDS (copy.ts) and WEBM_FILMS (films.ts), then the two lines below point at it. Until Studio's film arrives the slot shows the film that is there today.
import type { FilmManifest } from "./films";
import type { FilmId } from "./copy";
import clientManifest from "../../../public/films/client/manifest.json";

export const GUIDE_FILM_ID: FilmId = "client";
export const GUIDE_FILM_MANIFEST: FilmManifest = clientManifest as FilmManifest;
