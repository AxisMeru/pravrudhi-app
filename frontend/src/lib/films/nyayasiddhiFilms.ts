import type { FilmManifest } from "./films";
import type { FilmId } from "./copy";

// The NyayaSiddhi review cuts (unlisted route only). Each manifest is loaded by a DYNAMIC import, so the film's scene text is a chunk of its own and is never part of another page's chunks.
export const NYAYASIDDHI_FILMS = ["nyayasiddhi", "nyayasiddhi-loop", "nyayasiddhi-firm", "nyayasiddhi-narrated", "nyayasiddhi-firm-narrated", "nyayasiddhi-explainer", "nyayasiddhi-explainer-silent"] as const satisfies readonly FilmId[];
export type NyayasiddhiFilmId = (typeof NYAYASIDDHI_FILMS)[number];

const LOADERS: Record<NyayasiddhiFilmId, () => Promise<{ default: unknown }>> = {
  nyayasiddhi: () => import("../../../public/films/nyayasiddhi/manifest.json"),
  "nyayasiddhi-loop": () => import("../../../public/films/nyayasiddhi-loop/manifest.json"),
  "nyayasiddhi-firm": () => import("../../../public/films/nyayasiddhi-firm/manifest.json"),
  "nyayasiddhi-narrated": () => import("../../../public/films/nyayasiddhi-narrated/manifest.json"),
  "nyayasiddhi-firm-narrated": () => import("../../../public/films/nyayasiddhi-firm-narrated/manifest.json"),
  "nyayasiddhi-explainer": () => import("../../../public/films/nyayasiddhi-explainer/manifest.json"),
  "nyayasiddhi-explainer-silent": () => import("../../../public/films/nyayasiddhi-explainer-silent/manifest.json"),
};

export async function loadNyayasiddhiManifest(id: NyayasiddhiFilmId): Promise<FilmManifest> {
  return (await LOADERS[id]()).default as FilmManifest;
}
