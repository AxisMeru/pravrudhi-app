"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { FILM_CAPTIONS_HIDE, FILM_CAPTIONS_SHOW, FILM_DOWNLOAD_LINK, FILM_NARRATED_NOTE, FILM_PLAY_BUTTON, FILM_SILENT_NOTE, FILM_SOUND_OFF, FILM_SOUND_ON, FILM_SYNTHETIC_VOICE, FILM_TRANSCRIPT_HEADING, FILM_VIDEO_UNSUPPORTED, type FilmId } from "@/lib/films/copy";
import { FILM_MANIFESTS, WEBM_FILMS, clock, filmFile, type FilmManifest } from "@/lib/films/films";

const subscribe = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One film, played by the browser's own <video>: narrated but STARTING MUTED (so it can start anywhere; a visible button turns the sound on), captions OFF until the visitor asks (a visible button), controls on,
 * nothing downloaded until the visitor presses play (preload none), the poster first, and a plain link to download the same file.
 * Under prefers-reduced-motion, and for a film marked `posterFirst`, the poster stays until the visitor asks for the film with the button (no film bytes, no autoplay). The scene text below is the film's own and is always on the page.
 */
export function FilmPlayer({ id, manifest, posterFirst = false, downloadLabel = FILM_DOWNLOAD_LINK, posterAlt }: { id: FilmId; manifest?: FilmManifest; posterFirst?: boolean; downloadLabel?: string; posterAlt?: string }) {
  const film = manifest ?? (FILM_MANIFESTS as Record<string, FilmManifest>)[id];
  const reduced = useSyncExternalStore(subscribe, reducedNow, () => false);
  const [asked, setAsked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [captions, setCaptions] = useState(false); // captions are OFF until asked, on every film (the operator, 16 Oct); the button and the browser's own CC menu turn them on
  const video = useRef<HTMLVideoElement>(null);
  const showVideo = (!reduced && !posterFirst) || asked;
  // a film with no audio track (the manifest says audio:false) has no sound button: pressing it could only do nothing
  const hasAudio = film.audio !== false;
  const hasWebm = WEBM_FILMS.has(id);
  // one click turns the voice on: muted off, volume up, and play() in the SAME click if the film is paused; turning it off mutes again
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    if (v.muted || v.volume === 0) { v.muted = false; v.volume = 1; setMuted(false); if (v.paused) void v.play().catch(() => undefined); }
    else { v.muted = true; setMuted(true); }
  };
  // the captions track has no `default`: it starts disabled, and the visible button (or the browser's own CC menu) turns it on
  useEffect(() => {
    const t = video.current?.textTracks[0];
    if (t) t.mode = captions ? "showing" : "disabled";
  }, [captions, showVideo]);
  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted, showVideo]);
  // under reduced motion the "Play the film" button unmounts when the video appears: the focus goes to the video (not to the page) so a keyboard visitor stays at the film
  useEffect(() => { if (asked) video.current?.focus(); }, [asked]);
  return (
    <figure className="space-y-3" data-testid={`film-${id}`}>
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-black focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--color-accent)]" data-testid="film-frame">
        {showVideo ? (
          <video
            ref={video}
            className="block aspect-video w-full text-white"
            controls
            muted
            playsInline
            preload="none"
            poster={filmFile(id, "poster.png")}
            aria-label={film.title}
            data-testid="film-video"
            autoPlay={asked}
            onVolumeChange={(e) => setMuted(e.currentTarget.muted || e.currentTarget.volume === 0)}
          >
            {/* WebM first (VP9, with Opus when the film has a voice) for a client without H.264/AAC; the mp4 second (Safari) */}
            {hasWebm && <source src={filmFile(id, "film.webm")} type={hasAudio ? 'video/webm; codecs="vp9, opus"' : 'video/webm; codecs="vp9"'} />}
            <source src={filmFile(id, "film.mp4")} type="video/mp4" />
            <track kind="captions" src={filmFile(id, "captions.vtt")} srcLang="en" label="English" />
            {FILM_VIDEO_UNSUPPORTED}
          </video>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- a static export; the poster is a plain file in public/films */}
            <img src={filmFile(id, "poster.png")} alt={posterAlt ?? film.title} className="block aspect-video w-full object-cover" data-testid="film-poster" />
            <button type="button" onClick={() => setAsked(true)} className="absolute bottom-3 left-3 h-fit w-fit rounded-md print:hidden bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] min-h-11" data-testid="film-play">
              {FILM_PLAY_BUTTON}
            </button>
          </div>
        )}
      </div>
      <figcaption className="text-xs text-[var(--color-text-dim)]">{film.title}. {film.audio === false ? FILM_SILENT_NOTE : `${FILM_NARRATED_NOTE} ${FILM_SYNTHETIC_VOICE}`}</figcaption>
      <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
        {showVideo && (
          <>
            {hasAudio && (
              <button type="button" onClick={toggleSound} className="min-h-11 rounded-md border border-[var(--color-control-border)] px-3 py-1 text-[var(--color-text)]" data-testid="film-sound">
                {muted ? FILM_SOUND_ON : FILM_SOUND_OFF}
              </button>
            )}
            <button type="button" onClick={() => setCaptions((c) => !c)} className="min-h-11 rounded-md border border-[var(--color-control-border)] px-3 py-1 text-[var(--color-text)]" data-testid="film-captions">
              {captions ? FILM_CAPTIONS_HIDE : FILM_CAPTIONS_SHOW}
            </button>
          </>
        )}
        <a href={filmFile(id, "film.mp4")} download className="inline-flex min-h-11 items-center text-[var(--color-accent)] underline" data-testid="film-download">{downloadLabel}</a>
      </div>
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
