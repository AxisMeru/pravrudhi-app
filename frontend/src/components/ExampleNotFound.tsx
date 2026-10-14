import { EXAMPLE_ID, EXAMPLE_NOT_FOUND_LINK, EXAMPLE_NOT_FOUND_TEXT } from "@/lib/demo/example";

/** Shown when ?example=<id> names an example this app does not have (for instance a link to the retired example), with a link to the sample. `page` is the route the link goes to. */
export function ExampleNotFound({ page }: { page: "/screening" | "/matters" }) {
  return (
    <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)]" data-testid="example-not-found" role="status">
      {EXAMPLE_NOT_FOUND_TEXT}{" "}
      <a href={`${page}?example=${EXAMPLE_ID}`} className="text-[var(--color-accent)] underline">{EXAMPLE_NOT_FOUND_LINK}</a>
    </p>
  );
}
