export function PageHeader({ title, subtitle, crumb, focusable = false }: { title: string; subtitle?: string; crumb?: string[]; focusable?: boolean }) {
  return (
    <div className="border-b border-[var(--color-border)] py-6 pl-4 pr-4 sm:pr-8 md:pl-8 md:pr-20">
      {/* layout B: the breadcrumb (Screening › name › Result|Facts); the separators are decoration. Rendered only when a page passes `crumb`. */}
      {crumb && crumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1 text-xs text-[var(--color-text-dim)]" data-testid="breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-1.5">
            {crumb.map((c, i) => (
              <li key={i} className="flex items-center gap-x-1.5" aria-current={i === crumb.length - 1 ? "page" : undefined}>
                {i > 0 && <span aria-hidden="true">›</span>}
                {c}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <h1 {...(focusable ? { id: "page-title", tabIndex: -1 } : {})} className="text-xl font-semibold text-[var(--color-text)]">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-text-dim)]">{subtitle}</p>}
    </div>
  );
}
