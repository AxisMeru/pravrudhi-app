import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";

import { LAYOUT_MATTER_B } from "@/lib/layoutFlag";
import { FilmPlayer } from "@/components/films/FilmPlayer";
import { GUIDE_FILM_HEADING } from "@/lib/films/copy";
import { GUIDE_FILM_ID, GUIDE_FILM_MANIFEST, GUIDE_FILM_PICK, GUIDE_FILM_V2 } from "@/lib/films/guideFilm";
import { NarratedDefaultFilm } from "@/components/films/NarratedDefaultFilm";
import {
  GUIDE_ABOUT, GUIDE_ABOUT_HEADING, GUIDE_BEFORE, GUIDE_BEFORE_HEADING, GUIDE_BEFORE_LINK, GUIDE_COVERED, GUIDE_COVERED_HEADING, GUIDE_COVERED_NOTE, GUIDE_GLOSSARY, GUIDE_GLOSSARY_HEADING,
  GUIDE_BANNER_TEXT, GUIDE_COLD_START, GUIDE_COLD_START_HEADING, GUIDE_INTRO, GUIDE_INTRO_HEADING, GUIDE_LIMITS, GUIDE_LIMITS_HEADING, GUIDE_SCREENSHOT_NOTE, GUIDE_SCREENSHOT_NOTE_LB,
  GUIDE_STATUS_HEADING, GUIDE_STATUSES, GUIDE_STEPS, GUIDE_STEPS_HEADING, GUIDE_SUBTITLE, GUIDE_TITLE,
} from "@/lib/guide/copy";

// The user guide: what the screening assistant does, step by step with screens of an invented matter, what each status means, and the stated limits.
// All words are in lib/guide/copy.ts (R1 reads that list); the screenshots are in public/guide/.
export default function GuidePage() {
  return (
    <div>
      <PageHeader title={GUIDE_TITLE} subtitle={GUIDE_SUBTITLE} />
      <div className="mx-auto max-w-3xl space-y-8 p-8" data-testid="guide">
        <section>
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_INTRO_HEADING}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">{GUIDE_INTRO}</p>
          <p className="mt-2 text-xs text-[var(--color-text-dim)]" data-testid="guide-screenshot-note">{LAYOUT_MATTER_B ? GUIDE_SCREENSHOT_NOTE_LB : GUIDE_SCREENSHOT_NOTE}</p>
        </section>
        <section id="film" data-testid="guide-film">
          <h2 className="mb-2 text-base font-medium text-[var(--color-text)]">{GUIDE_FILM_HEADING}</h2>
          {GUIDE_FILM_V2 ? <NarratedDefaultFilm narrated={GUIDE_FILM_PICK.narrated} silent={GUIDE_FILM_PICK.silent} narratedId={GUIDE_FILM_PICK.narratedId} silentId={GUIDE_FILM_PICK.silentId} /> : <FilmPlayer id={GUIDE_FILM_ID} manifest={GUIDE_FILM_MANIFEST} />}
        </section>
        <section data-testid="guide-about">
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_ABOUT_HEADING}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">{GUIDE_ABOUT}</p>
        </section>
        <section data-testid="guide-covered">
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_COVERED_HEADING}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-dim)]">
            {GUIDE_COVERED.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-[var(--color-text-dim)]">{GUIDE_COVERED_NOTE}</p>
        </section>
        <section data-testid="guide-before">
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_BEFORE_HEADING}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">{GUIDE_BEFORE}</p>
          <p className="mt-1 text-sm"><Link href="/data-handling" className="inline-flex min-h-6 items-center text-[var(--color-accent)] underline">{GUIDE_BEFORE_LINK}</Link></p>
        </section>
        <section className="space-y-6">
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_STEPS_HEADING}</h2>
          {GUIDE_STEPS.map((s) => (
            <article key={s.id} className="space-y-2" data-testid="guide-step">
              <h3 className="text-sm font-medium text-[var(--color-text)]">{s.heading}</h3>
              <p className="text-sm text-[var(--color-text-dim)]">{s.text}</p>
              {s.image && (
                // eslint-disable-next-line @next/next/no-img-element -- a static export; the screenshots are plain files in public/guide
                <img src={`/guide/${s.image.file}`} alt={s.image.alt} className="w-full rounded-md border border-[var(--color-border)]" loading="lazy" />
              )}
              {s.image?.caption && <p className="text-xs text-[var(--color-text-dim)]" data-testid="guide-caption">{s.image.caption}</p>}
            </article>
          ))}
        </section>
        <section>
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_STATUS_HEADING}</h2>
          <dl className="mt-2 space-y-2" data-testid="guide-statuses">
            {GUIDE_STATUSES.map((s) => (
              <div key={s.label}>
                <dt className="text-sm font-medium text-[var(--color-text)]">{s.label}</dt>
                <dd className="text-sm text-[var(--color-text-dim)]">{s.meaning}</dd>
                {s.note && <dd className="text-sm text-[var(--color-text-dim)]" data-testid="guide-defence-note">{s.note}</dd>}
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-[var(--color-text-dim)]">{GUIDE_BANNER_TEXT}</p>
        </section>
        <section>
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_LIMITS_HEADING}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-dim)]" data-testid="guide-limits">
            {GUIDE_LIMITS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
        <section data-testid="guide-glossary">
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_GLOSSARY_HEADING}</h2>
          <ul className="mt-2 space-y-2" data-testid="guide-glossary-list">
            {GUIDE_GLOSSARY.map((g) => (
              <li key={g.term} className="text-sm text-[var(--color-text-dim)]">
                <span className="font-medium text-[var(--color-text)]">{g.term}</span>: {g.meaning}
                {g.note && <span className="mt-1 block" data-testid="guide-glossary-defence-note">{g.note}</span>}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-base font-medium text-[var(--color-text)]">{GUIDE_COLD_START_HEADING}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]" data-testid="guide-cold-start">{GUIDE_COLD_START}</p>
        </section>
      </div>
    </div>
  );
}
