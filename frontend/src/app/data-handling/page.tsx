import { PageHeader } from "@/components/PageHeader";
import { DATA_HANDLING_FOOTER, DATA_HANDLING_PAGE, DATA_HANDLING_SUBTITLE, DATA_HANDLING_TITLE, type DataHandlingSection } from "@/lib/dataHandling";

// What leaves the firm, where it is processed, how long it is kept. All words are in lib/dataHandling.ts (R1's exact text); nothing is computed here.
// Layout (P10): "At a glance" first, then the standard sections, then (assistant flag on) the two routes as labelled groups below the standard sections.
function Paragraphs({ s, only }: { s: DataHandlingSection; only?: string[] }) {
  const paragraphs = only ?? s.paragraphs;
  return (
    <>
      {paragraphs.map((p) => {
        // each link goes on the FIRST paragraph of the section that contains its phrase; a paragraph carries at most one link
        const link = (s.links ?? []).find((l) => s.paragraphs.findIndex((x) => x.includes(l.text)) === s.paragraphs.indexOf(p) && p.includes(l.text));
        const at = link ? p.indexOf(link.text) : -1;
        return (
          <p key={p} className="mt-1 text-sm text-[var(--color-text-dim)]">
            {link && at >= 0 ? (
              <>
                {p.slice(0, at)}
                <a href={link.href} className="text-[var(--color-accent)] underline" target="_blank" rel="noreferrer">{link.text}</a>
                {p.slice(at + link.text.length)}
              </>
            ) : p}
          </p>
        );
      })}
    </>
  );
}

export default function DataHandlingPage() {
  const { glance, standard, assistant } = DATA_HANDLING_PAGE;
  return (
    <div>
      <PageHeader title={DATA_HANDLING_TITLE} subtitle={DATA_HANDLING_SUBTITLE} />
      <div className="mx-auto max-w-3xl space-y-6 p-8" data-testid="data-handling">
        <section aria-labelledby="dh-glance-heading" data-testid="dh-glance" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 id="dh-glance-heading" className="text-base font-medium text-[var(--color-text)]">{glance.heading}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]" data-testid="dh-glance-line">{glance.line}</p>
          <div className="mt-3 space-y-4">
            {glance.blocks.map((b) => (
              <div key={b.id} data-testid={`dh-glance-${b.id}`}>
                <h3 className="text-sm font-medium text-[var(--color-text)]">{b.heading}</h3>
                {b.texts.map((t) => <p key={t} className="mt-1 text-sm text-[var(--color-text-dim)]">{t}</p>)}
                <a href={b.href} className="mt-1 inline-block text-sm text-[var(--color-accent)] underline" data-testid={`dh-glance-link-${b.id}`} aria-label={`${glance.linkText}: ${b.heading}`}>{glance.linkText}</a>
              </div>
            ))}
          </div>
          {glance.assistantLine && (
            <p className="mt-4 text-sm text-[var(--color-text-dim)]" data-testid="dh-glance-assistant">
              {glance.assistantLine.before}
              <a href={glance.assistantLine.href} className="text-[var(--color-accent)] underline" data-testid="dh-glance-assistant-link">{glance.assistantLine.link}</a>
              {glance.assistantLine.after}
            </p>
          )}
        </section>
        {standard.map((s) => (
          <section key={s.id} id={`dh-${s.id}`} data-testid={`dh-${s.id}`}>
            <h2 className="text-base font-medium text-[var(--color-text)]">{s.heading}</h2>
            <Paragraphs s={s} />
          </section>
        ))}
        {assistant && (
          <section id="dh-assistant" data-testid="dh-assistant">
            <h2 className="text-base font-medium text-[var(--color-text)]">{assistant.section.heading}</h2>
            {assistant.groups.map((g, i) => (
              <div key={g.label} role="group" aria-label={g.label} data-testid={`dh-route-${i === 0 ? "a" : "b"}`} className="mt-3">
                <h3 className="text-sm font-medium text-[var(--color-text)]">{g.label}</h3>
                <Paragraphs s={assistant.section} only={g.paragraphs} />
              </div>
            ))}
          </section>
        )}
        <p className="text-sm text-[var(--color-text)]">{DATA_HANDLING_FOOTER}</p>
      </div>
    </div>
  );
}
