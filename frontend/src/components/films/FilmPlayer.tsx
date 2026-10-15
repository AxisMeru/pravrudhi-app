"use client";

import { useState, useSyncExternalStore } from "react";

import { FILM_PLAY_BUTTON, FILM_SILENT_NOTE, FILM_TRANSCRIPT_HEADING, FILM_VIDEO_UNSUPPORTED, type FilmId } from "@/lib/films/copy";
import { FILM_MANIFESTS, clock, filmFile } from "@/lib/films/films";

const subscribe = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One film, played by the browser's own <video>: silent, with controls and captions on, nothing downloaded until the visitor presses play (preload none), the poster first.
 * Under prefers-reduced-motion the poster stays until the visitor asks for the film with the button. The scene text below is the film's own and is always on the page.
 */
export function FilmPlayer({ id }: { id: FilmId }) {
  const film = FILM_MANIFESTS[id];
  const reduced = useSyncExternalStore(subscribe, reducedNow, () => false);
  const [asked, setAsked] = useState(false);
  const showVideo = !reduced || asked;
  return (
    <figure className="space-y-3" data-testid={`film-${id}`}>
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-black">
        {showVideo ? (
          <video
            className="block aspect-video w-full"
            controls
            muted
            playsInline
            preload="none"
            poster={filmFile(id, "poster.png")}
            aria-label={film.title}
            data-testid="film-video"
            autoPlay={reduced && asked}
          >
            <source src={filmFile(id, "film.mp4")} type="video/mp4" />
            <track kind="captions" src={filmFile(id, "captions.vtt")} srcLang="en" label="English" default />
            {FILM_VIDEO_UNSUPPORTED}
          </video>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- a static export; the poster is a plain file in public/films */}
            <img src={filmFile(id, "poster.png")} alt={film.title} className="block aspect-video w-full object-cover" data-testid="film-poster" />
            <button type="button" onClick={() => setAsked(true)} className="absolute inset-0 m-auto h-fit w-fit rounded-md bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] min-h-11" data-testid="film-play">
              {FILM_PLAY_BUTTON}
            </button>
          </div>
        )}
      </div>
      <figcaption className="text-xs text-[var(--color-text-dim)]">{film.title}. {FILM_SILENT_NOTE}</figcaption>
      <section aria-label={FILM_TRANSCRIPT_HEADING} data-testid="film-scenes">
        <h3 className="text-sm font-medium text-[var(--color-text)]">{FILM_TRANSCRIPT_HEADING}</h3>
        <ol className="mt-1 space-y-1 text-sm text-[var(--color-text-dim)]">
          {film.scenes.map((s) => (
            <li key={s.startS}><span className="font-mono text-xs">{clock(s.startS)}</span> <span className="text-[var(--color-text)]">{s.name}.</span> {s.text}</li>
          ))}
        </ol>
      </section>
    </figure>
  );
}
