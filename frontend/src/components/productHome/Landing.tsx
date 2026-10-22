import Link from "next/link";

import { HOME_COPY as C, HOME_FILMS, HOME_READ_MORE } from "@/lib/productHome/copy";

/** The signed-out landing at "/" (app#539): the guide's own lines, Sign in, the three films as links, the main pages, one standing line. No figure, no sign-up button. */
export function Landing() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:p-8" data-testid="home-landing">
      <section>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{C.heading}</h1>
        <p className="mt-2 text-sm text-[var(--color-text)]">{C.lead}</p>
        <p className="mt-4">
          <Link href="/signin" className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-accent)]" data-testid="home-signin">{C.signIn}</Link>
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-dim)]" data-testid="home-no-new-accounts">{C.noNewAccounts}</p>
      </section>
      <section aria-labelledby="home-films-heading">
        <h2 id="home-films-heading" className="text-base font-medium text-[var(--color-text)]">{C.filmsHeading}</h2>
        <ul className="mt-2 grid gap-3 sm:grid-cols-3" data-testid="home-films">
          {HOME_FILMS.map((f) => (
            <li key={f.title} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
              <Link href={f.href} className="inline-flex min-h-6 items-center font-medium underline max-md:min-h-11">{f.title}</Link>
              <p className="mt-1 text-xs text-[var(--color-text-dim)]">{f.length} · {f.line}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--color-text-dim)]">{C.syntheticVoice}</p>
      </section>
      <section aria-labelledby="home-read-heading">
        <h2 id="home-read-heading" className="text-base font-medium text-[var(--color-text)]">{C.readMoreHeading}</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="home-read-more">
          {HOME_READ_MORE.map((l) => (<li key={l.href}><Link href={l.href} className="inline-flex min-h-6 items-center underline max-md:min-h-11">{l.label}</Link></li>))}
        </ul>
      </section>
      <p className="text-xs text-[var(--color-text)]">{C.standing}</p>
    </div>
  );
}
