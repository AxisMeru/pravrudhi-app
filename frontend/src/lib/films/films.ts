import clientManifest from "../../../public/films/client/manifest.json";
import technicalManifest from "../../../public/films/technical/manifest.json";
import { FILM_DIR, type FilmId } from "./copy";

export interface FilmScene { name: string; text: string; startS: number; endS: number }
export interface FilmManifest { title: string; durationS: number; width: number; height: number; audio?: boolean; files?: { name: string }[]; scenes: FilmScene[] }

/** The two public films' manifests (client, technical): static, they are on the Guide and How-it-was-built pages. The NyayaSiddhi review cuts' manifests are NOT here: the unlisted review route loads them itself (lib/films/nyayasiddhiFilms.ts), so their scene text stays out of every other page's chunks. */
export const FILM_MANIFESTS: Record<"client" | "technical", FilmManifest> = { client: clientManifest as FilmManifest, technical: technicalManifest as FilmManifest };

/** The NyayaSiddhi cuts that ship a film.webm beside the mp4 (the manifests list only the mp4; Studio's v6 delivery adds the WebM for all five). The player lists the WebM first for these. */
export const WEBM_FILMS: ReadonlySet<string> = new Set(["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm", "nyayasiddhi-narrated", "nyayasiddhi-firm-narrated"]);

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** The URL of one rendered file of a film (static export: the build's base path is added by hand). */
export const filmFile = (id: FilmId, name: "film.mp4" | "film.webm" | "poster.png" | "captions.vtt"): string => `${basePath}${FILM_DIR}/${id}/${name}`;

/** "1:05" for a time in seconds. */
export const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
