import { Fragment } from "react";

import { FilmPlayer } from "@/components/films/FilmPlayer";
import { HowBuiltDataSection } from "@/components/HowBuiltDataSection";
import { PageHeader } from "@/components/PageHeader";
import { TECHNICAL_FILM_SUBTITLE, TECHNICAL_FILM_TITLE } from "@/lib/films/copy";
import { HOW_BUILT_CARDS, HOW_BUILT_STORY, HOW_BUILT_TITLE } from "@/lib/howItWasBuilt";

// All words are in lib/howItWasBuilt.ts (the explorer's signed #914 text); nothing is computed here.
export default function HowItWasBuiltPage() {
  return (
    <div>
      <PageHeader title={HOW_BUILT_TITLE} />
      <div className="mx-auto max-w-3xl space-y-6 p-8" data-testid="how-built">
        <p className="text-sm text-[var(--color-text)]" data-testid="how-built-story">{HOW_BUILT_STORY}</p>
        {HOW_BUILT_CARDS.map((c, i) => (
          <Fragment key={c.title}>
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5" data-testid={`how-built-card-${i + 1}`}>
            <h2 className="text-base font-medium text-[var(--color-text)]">{i + 1}. {c.title}</h2>
            <ul className="mt-2 space-y-2 text-sm text-[var(--color-text-dim)]">
              {c.items.map((it) => (
                <li key={it.text}>
                  {it.label && <span className="font-medium text-[var(--color-text)]">{it.label}: </span>}
                  {it.text}
                </li>
              ))}
            </ul>
          </section>
          {i === 0 && <HowBuiltDataSection />}
          </Fragment>
        ))}
        {/* Operator direction (15 Oct): the technical film lives on this page, at the END (R1's placement). The heading and the line under it are the signed title and subtitle of the film's own page; the /technical-film route stays. */}
        <section aria-labelledby="how-built-film-heading" data-testid="how-built-film">
          <h2 id="how-built-film-heading" className="text-base font-medium text-[var(--color-text)]">{TECHNICAL_FILM_TITLE}</h2>
          <p className="mb-3 mt-1 text-sm text-[var(--color-text-dim)]">{TECHNICAL_FILM_SUBTITLE}</p>
          <FilmPlayer id="technical" />
        </section>
      </div>
    </div>
  );
}
