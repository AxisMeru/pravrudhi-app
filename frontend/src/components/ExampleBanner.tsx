import { EXAMPLE_NOT_FOUND_LINK, EXAMPLE_NOT_FOUND_TEXT, DEFAULT_EXAMPLE, type DemoExample } from "@/lib/demo/example";

/** The banner over a loaded example: R1's label and the order's citation as the court printed it. */
export function ExampleBanner({ example }: { example: DemoExample }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)]" data-testid="example-banner">
      <p className="m-0">{example.label}</p>
      <p className="m-0 mt-1 text-[var(--color-text-dim)]" data-testid="example-citation">{example.citation}</p>
      {example.screeningLine && <p className="m-0 mt-1 text-[var(--color-text-dim)]" data-testid="example-screening-line">{example.screeningLine}</p>}
    </div>
  );
}

/** Shown when ?example=<id> names an example this app does not have, with a link to the first example. `page` is the route the link goes to. */
export function ExampleNotFound({ page }: { page: "/screening" | "/matters" }) {
  return (
    <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)]" data-testid="example-not-found" role="status">
      {EXAMPLE_NOT_FOUND_TEXT}{" "}
      <a href={`${page}?example=${DEFAULT_EXAMPLE.id}`} className="text-[var(--color-accent)] underline">{EXAMPLE_NOT_FOUND_LINK}</a>
    </p>
  );
}
