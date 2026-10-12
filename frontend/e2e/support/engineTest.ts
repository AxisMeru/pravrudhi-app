import { expect, test as base, type Route } from "@playwright/test";

import { mockViolations, type MockedEndpoint } from "../../src/lib/mockSchema";

/**
 * `test` for every spec that mocks an engine answer. Any 200 JSON answer a mock gives to analyse-facts or verify-citations is checked against the
 * engine's pinned OpenAPI response schema (src/lib/mockSchema.ts); a mock carrying a field production never sends, or lacking one it always sends,
 * fails the test at its end with the list of violations. Specs import { expect, test } from here instead of "@playwright/test".
 */
const ENDPOINTS: MockedEndpoint[] = ["analyse-facts", "verify-citations"];

function endpointOf(url: string): MockedEndpoint | null {
  const path = new URL(url).pathname;
  return ENDPOINTS.find((e) => path === `/api/v1/${e}`) ?? null;
}

export const test = base.extend<{ _mockSchema: void }>({
  _mockSchema: [async ({ page }, use) => {
    const violations: string[] = [];
    const route = page.route.bind(page);
    (page as { route: unknown }).route = ((url: Parameters<typeof route>[0], handler: (r: Route, q: ReturnType<Route["request"]>) => unknown, opts?: Parameters<typeof route>[2]) =>
      route(url, (r, q) => handler(new Proxy(r, {
        get(t, p) {
          if (p !== "fulfill") { const v = Reflect.get(t, p); return typeof v === "function" ? v.bind(t) : v; }
          return (o: Parameters<Route["fulfill"]>[0] = {}) => {
            const e = endpointOf(q.url());
            if (e && (o.status ?? 200) === 200 && o.json !== undefined) violations.push(...mockViolations(e, o.json).map((v) => `${e}: ${v}`));
            return t.fulfill(o);
          };
        },
      }), q), opts)) as typeof page.route;
    await use();
    expect(violations, "mock answers that do not match the engine's response schema").toEqual([]);
  }, { auto: true }],
});

export { expect };
