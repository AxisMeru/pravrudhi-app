import { PageHeader } from "@/components/PageHeader";
import { DATA_HANDLING_FOOTER, DATA_HANDLING_SECTIONS, DATA_HANDLING_SUBTITLE, DATA_HANDLING_TITLE } from "@/lib/dataHandling";

// What leaves the firm, where it is processed, how long it is kept. All words are in lib/dataHandling.ts (R1's exact text); nothing is computed here.
export default function DataHandlingPage() {
  return (
    <div>
      <PageHeader title={DATA_HANDLING_TITLE} subtitle={DATA_HANDLING_SUBTITLE} />
      <div className="mx-auto max-w-3xl space-y-6 p-8" data-testid="data-handling">
        {DATA_HANDLING_SECTIONS.map((s) => (
          <section key={s.id} id={`dh-${s.id}`} data-testid={`dh-${s.id}`}>
            <h2 className="text-base font-medium text-[var(--color-text)]">{s.heading}</h2>
            {s.paragraphs.map((p, pi) => {
              const linkAt = s.link ? s.paragraphs.findIndex((x) => x.includes(s.link!.text)) : -1; // the link is on the FIRST paragraph that has the phrase only
              const at = s.link && pi === linkAt ? p.indexOf(s.link.text) : -1;
              return (
                <p key={p} className="mt-1 text-sm text-[var(--color-text-dim)]">
                  {s.link && at >= 0 ? (
                    <>
                      {p.slice(0, at)}
                      <a href={s.link.href} className="text-[var(--color-accent)] underline" target="_blank" rel="noreferrer">{s.link.text}</a>
                      {p.slice(at + s.link.text.length)}
                    </>
                  ) : p}
                </p>
              );
            })}
          </section>
        ))}
        <p className="text-sm text-[var(--color-text)]">{DATA_HANDLING_FOOTER}</p>
      </div>
    </div>
  );
}
