import clientManifest from "../../../public/films/client/manifest.json";
import nyayasiddhiFirmNarratedManifest from "../../../public/films/nyayasiddhi-firm-narrated/manifest.json";
import nyayasiddhiFirmManifest from "../../../public/films/nyayasiddhi-firm/manifest.json";
import nyayasiddhiLoopManifest from "../../../public/films/nyayasiddhi-loop/manifest.json";
import nyayasiddhiNarratedManifest from "../../../public/films/nyayasiddhi-narrated/manifest.json";
import nyayasiddhiManifest from "../../../public/films/nyayasiddhi/manifest.json";
import technicalManifest from "../../../public/films/technical/manifest.json";
import { FILM_DIR, type FilmId } from "./copy";

export interface FilmScene { name: string; text: string; startS: number; endS: number }
export interface FilmManifest { title: string; durationS: number; width: number; height: number; audio?: boolean; scenes: FilmScene[] }

export const FILM_MANIFESTS: Record<FilmId, FilmManifest> = { client: clientManifest as FilmManifest, technical: technicalManifest as FilmManifest, nyayasiddhi: nyayasiddhiManifest as FilmManifest, "nyayasiddhi-loop": nyayasiddhiLoopManifest as FilmManifest, "nyayasiddhi-firm": nyayasiddhiFirmManifest as FilmManifest, "nyayasiddhi-narrated": nyayasiddhiNarratedManifest as FilmManifest, "nyayasiddhi-firm-narrated": nyayasiddhiFirmNarratedManifest as FilmManifest };

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** The URL of one rendered file of a film (static export: the build's base path is added by hand). */
export const filmFile = (id: FilmId, name: "film.mp4" | "poster.png" | "captions.vtt"): string => `${basePath}${FILM_DIR}/${id}/${name}`;

/** "1:05" for a time in seconds. */
export const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
