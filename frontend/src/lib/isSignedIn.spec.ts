import { strict as assert } from "node:assert";
import test from "node:test";

import { isSignedIn } from "./api";

// GET /api/me for the assistant entry (#125; R1/R2 14 Oct): true on 200; false ONLY on a clear 401 or a 404/405; null on anything else, so an identity call that errored shows nothing.
async function me(handler: () => Response | Promise<Response>): Promise<boolean | null> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => handler()) as typeof fetch;
  try {
    return await isSignedIn();
  } finally {
    globalThis.fetch = original;
  }
}

test("isSignedIn: 200 is true; 401, 404 and 405 are false", async () => {
  assert.equal(await me(() => new Response("{}", { status: 200 })), true);
  for (const status of [401, 404, 405]) assert.equal(await me(() => new Response("{}", { status })), false, String(status));
});

test("isSignedIn: 403, 5xx, a dropped connection and a thrown error are null (nothing shown), never false", async () => {
  for (const status of [403, 500, 502, 503, 504]) assert.equal(await me(() => new Response("{}", { status })), null, String(status));
  assert.equal(await me(() => { throw new TypeError("fetch failed"); }), null);
  assert.equal(await me(() => Promise.reject(new DOMException("timed out", "TimeoutError"))), null);
});
