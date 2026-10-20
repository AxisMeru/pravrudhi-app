"use client";

import { useState, useSyncExternalStore } from "react";

import { FilmPlayer } from "@/components/films/FilmPlayer";
import { BENCHMARKS_FILM_POSTER_ALT, FILM_DOWNLOAD_LINK, FILM_DOWNLOAD_NARRATED } from "@/lib/films/copy";
import type { FilmManifest } from "@/lib/films/films";

const subscribe = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The NyayaSiddhi explainer on /benchmarks: the NARRATED cut is the default (operator, 20 Oct: the film he opened had no voice). Sound is on from the moment the visitor presses Play, with a visible Mute button.
 * (Each cut has its own key: switching cut resets the player state, so the silent cut never inherits the narrated cut's sound-on state.)
 * The SILENT cut is the fallback, shown instead when (1) the visitor prefers reduced motion, or (2) the narrated cut could not be played (the browser reported a media error). Poster first either way: nothing is requested until Play.
 */
export function NarratedDefaultFilm({ narrated, silent }: { narrated: FilmManifest; silent: FilmManifest }) {
  const reduced = useSyncExternalStore(subscribe, reducedNow, () => false);
  const [failed, setFailed] = useState(false);
  if (reduced || failed) {
    return <FilmPlayer key="nyayasiddhi-explainer-silent" id="nyayasiddhi-explainer-silent" manifest={silent} posterFirst downloadLabel={FILM_DOWNLOAD_LINK} posterAlt={BENCHMARKS_FILM_POSTER_ALT} />;
  }
  return <FilmPlayer key="nyayasiddhi-explainer" id="nyayasiddhi-explainer" manifest={narrated} posterFirst soundOnPlay downloadLabel={FILM_DOWNLOAD_NARRATED} posterAlt={BENCHMARKS_FILM_POSTER_ALT} onPlaybackError={() => setFailed(true)} />;
}
