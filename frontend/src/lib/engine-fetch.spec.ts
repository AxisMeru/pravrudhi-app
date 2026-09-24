import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Every engine call carries the signed-in session (ADR-0051 addendum 3). A page module that calls fetch() on the
// engine base itself sends no token, and on a hosted engine that is "could not reach" for the page it serves —
// which is exactly how the first signed-in operator found the Requests page on 2026-09-12. engineFetch in api.ts
// is the one place the token, the renewal and the 401 handling live; nothing else may fetch the engine.
test("no module fetches the engine outside engineFetch", () => {
  const dir = __dirname;
  const offenders: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".ts") || name.endsWith(".spec.ts")) continue;
    const text = readFileSync(join(dir, name), "utf8");
    for (const [i, line] of text.split("\n").entries()) {
      const bare = /(?<![A-Za-z_])fetch\(`\$\{(apiBase|detectBase)\(\)\}/.test(line);
      if (bare) offenders.push(`${name}:${i + 1}`);
    }
  }
  assert.deepEqual(offenders, [], `bare engine fetches: ${offenders.join(", ")}`);
});

// engineFetch's authOptional flag (2026-09-24): a real incident where every anonymous page load 401'd on
// edition()'s /api/me probe and the blanket redirect below fired for it, bouncing an anonymous visitor off a
// page (like /matters) that's genuinely supposed to work without signing in, before that page's own content
// ever rendered. Fixed by scoping the redirect to calls that actually need it.

function withAnonymousBrowser<T>(fn: (assignCalls: string[]) => Promise<T>): Promise<T> {
  const globalAsAny = globalThis as unknown as { window?: unknown };
  const originalWindow = globalAsAny.window;
  const assignCalls: string[] = [];
  globalAsAny.window = {
    location: { pathname: "/matters", origin: "http://localhost", assign: (url: string) => assignCalls.push(url) },
  };
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  return (async () => {
    try {
      return await fn(assignCalls);
    } finally {
      globalAsAny.window = originalWindow;
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
  })();
}

test("engineFetch: an anonymous 401 with authOptional does not redirect to /signin", async () => {
  const { engineFetch } = await import("./api");
  await withAnonymousBrowser(async (assignCalls) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ detail: "Missing bearer token" }), { status: 401 })) as typeof fetch;
    try {
      const res = await engineFetch("http://localhost/api/me", { authOptional: true });
      assert.equal(res.status, 401, "the 401 is still returned to the caller");
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.deepEqual(assignCalls, [], "authOptional must never trigger a /signin redirect");
  });
});

test("engineFetch: an anonymous 401 without authOptional still redirects to /signin", async () => {
  const { engineFetch } = await import("./api");
  await withAnonymousBrowser(async (assignCalls) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ detail: "Missing bearer token" }), { status: 401 })) as typeof fetch;
    try {
      await engineFetch("http://localhost/api/objectives");
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(assignCalls.length, 1, "an auth-required call that gets a 401 must still redirect");
    assert.match(assignCalls[0], /\/signin$/);
  });
});

// Real incident (2026-09-24): localToken()'s own /api/app-token probe -- a same-origin local-write-guard,
// not the user's session -- 401s on every hosted-engine call (postJSON/putJSON/deleteJSON/analyseFacts, for
// every visitor, signed in or not), and its 401 ALSO fired the global /signin redirect as an unrelated side
// effect, even though the probe's own failure was already silently tolerated two lines later ("no local
// token"). This is what actually bounced an anonymous /matters visit to /signin mid-request, after the
// edition()/notifications() fixes alone weren't enough to stop it.
test("localToken: a 401 from the local-token probe (a hosted engine, no local write-guard) does not redirect", async () => {
  const { localToken } = await import("./api");
  await withAnonymousBrowser(async (assignCalls) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ detail: "not found" }), { status: 401 })) as typeof fetch;
    try {
      const token = await localToken();
      assert.equal(token, null, "no local token on a hosted engine that doesn't serve this route");
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.deepEqual(assignCalls, [], "a failed local-token probe must never redirect to /signin");
  });
});
