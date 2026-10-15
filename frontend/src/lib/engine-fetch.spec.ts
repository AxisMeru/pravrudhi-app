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
  const { localToken, forgetLocalToken } = await import("./api");
  forgetLocalToken();
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

// Lead-2, 15 Oct: the probe's "no local token" answer (401/403/404) is remembered for the visit: one request, however many writes follow; a network failure is not remembered.
test("localToken: a refused probe (403) is asked once; a network failure is asked again", async () => {
  const { localToken, forgetLocalToken } = await import("./api");
  await withAnonymousBrowser(async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    try {
      forgetLocalToken();
      globalThis.fetch = (async () => { calls += 1; return new Response(JSON.stringify({ detail: "forbidden" }), { status: 403 }); }) as typeof fetch;
      assert.equal(await localToken(), null);
      assert.equal(await localToken(), null);
      assert.equal(await localToken(), null);
      assert.equal(calls, 1, "the refused probe is not repeated on every write");
      forgetLocalToken();
      calls = 0;
      globalThis.fetch = (async () => { calls += 1; throw new TypeError("network down"); }) as typeof fetch;
      assert.equal(await localToken(), null);
      assert.equal(await localToken(), null);
      assert.equal(calls, 2, "a network failure is not remembered");
    } finally {
      globalThis.fetch = originalFetch;
      forgetLocalToken();
    }
  });
});

// R2 (#212): a transient answer (429, 5xx) on the first write must not make a local desktop engine lose its token for the whole visit: only 401/403/404 are remembered.
test("localToken: 429 and 5xx are not remembered: the next call asks again and gets the token", async () => {
  const { localToken, forgetLocalToken } = await import("./api");
  for (const status of [503, 502, 500, 429]) {
    await withAnonymousBrowser(async () => {
      const originalFetch = globalThis.fetch;
      let calls = 0;
      try {
        forgetLocalToken();
        globalThis.fetch = (async () => {
          calls += 1;
          return calls === 1 ? new Response(JSON.stringify({ detail: "busy" }), { status }) : new Response(JSON.stringify({ token: "local-token" }), { status: 200 });
        }) as typeof fetch;
        assert.equal(await localToken(), null, `${status}: no token this time`);
        assert.equal(await localToken(), "local-token", `${status}: asked again, token received`);
        assert.equal(calls, 2);
      } finally {
        globalThis.fetch = originalFetch;
        forgetLocalToken();
      }
    });
  }
  for (const status of [401, 403, 404]) {
    await withAnonymousBrowser(async () => {
      const originalFetch = globalThis.fetch;
      let calls = 0;
      try {
        forgetLocalToken();
        globalThis.fetch = (async () => { calls += 1; return new Response(JSON.stringify({ detail: "no" }), { status }); }) as typeof fetch;
        await localToken();
        await localToken();
        assert.equal(calls, 1, `${status} is remembered`);
      } finally {
        globalThis.fetch = originalFetch;
        forgetLocalToken();
      }
    });
  }
});

// #137: an anonymous visitor of a HOSTED engine (NEXT_PUBLIC_API_BASE set, no web session) does not ask the identity probe (it would only log a 401 on every page); everyone else still does.
test("isSignedIn and edition skip the /api/me probe for an anonymous visitor of a hosted engine, and ask it otherwise", async () => {
  const { isSignedIn, forgetLocalToken } = await import("./api");
  const { edition, PRODUCT } = await import("./edition");
  forgetLocalToken();
  await withAnonymousBrowser(async () => {
    const originalFetch = globalThis.fetch;
    const prev = process.env.NEXT_PUBLIC_API_BASE;
    let meCalls = 0;
    globalThis.fetch = (async (url: string | URL | Request) => { if (String(url).includes("/api/me")) meCalls += 1; return new Response("{}", { status: 401 }); }) as typeof fetch;
    try {
      process.env.NEXT_PUBLIC_API_BASE = "https://engine.example";
      assert.equal(await isSignedIn(), false);
      assert.deepEqual(await edition(), PRODUCT);
      assert.equal(meCalls, 0, "hosted + no session: no probe");
      delete process.env.NEXT_PUBLIC_API_BASE;
      assert.equal(await isSignedIn(), false);
      await edition();
      assert.equal(meCalls, 2, "an engine that serves the page itself still answers the probe");
      // third arm (R2, #230): a HOSTED engine with a SIGNED-IN session is still asked, and the answer is believed (the guard must not read as "signed out" for a signed-in visitor)
      const { setSession, clearSession } = await import("./auth");
      setSession("invented-token", { id: "u-invented", email: "invented@example.test" });
      try {
        process.env.NEXT_PUBLIC_API_BASE = "https://engine.example";
        meCalls = 0;
        globalThis.fetch = (async (url: string | URL | Request) => {
          if (String(url).includes("/api/me")) meCalls += 1;
          return new Response(JSON.stringify({ edition: "Pravrudhi", access: "member" }), { status: 200 });
        }) as typeof fetch;
        assert.equal(await isSignedIn(), true, "hosted + signed in: the stubbed 200 reads as signed in");
        assert.equal(meCalls, 1, "the probe is asked for isSignedIn");
        const e = await edition();
        assert.equal(e.edition, PRODUCT.edition);
        assert.equal(meCalls, 2, "and for edition");
      } finally {
        clearSession();
      }
    } finally {
      globalThis.fetch = originalFetch;
      if (prev === undefined) delete process.env.NEXT_PUBLIC_API_BASE; else process.env.NEXT_PUBLIC_API_BASE = prev;
    }
  });
});

// #259: signed out on a HOSTED engine, Check sends NOTHING (no app-token request, no verify request carrying the citation); a signed-in visitor of a hosted engine and anyone on an engine that serves the page itself still send the check.
test("verifyCitation: an anonymous visitor of a hosted engine sends no request at all; signed in, or a self-serving engine, still sends it", async () => {
  const { verifyCitation, ApiError, forgetLocalToken } = await import("./api");
  forgetLocalToken();
  await withAnonymousBrowser(async () => {
    const originalFetch = globalThis.fetch;
    const prev = process.env.NEXT_PUBLIC_API_BASE;
    const seen: string[] = [];
    const sentTo = (path: string, body?: string): boolean => seen.some((r) => r.includes(path) && (body === undefined || r.includes(body)));
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => { seen.push(`${String(url)} ${String(init?.body ?? "")}`); return new Response(JSON.stringify({ result: "NOT_IN_INDEX", note: "n" }), { status: 200 }); }) as typeof fetch;
    try {
      process.env.NEXT_PUBLIC_API_BASE = "https://engine.example";
      await assert.rejects(() => verifyCitation("(2099) 1 SCC 1", null), (e: unknown) => e instanceof ApiError && e.status === 401);
      assert.deepEqual(seen, [], "hosted + no session: no request of any kind, so the citation never left the browser");
      // a hosted engine with a signed-in session: the check is sent
      const { setSession, clearSession } = await import("./auth");
      setSession("invented-token", { id: "u-invented", email: "invented@example.test" });
      try {
        await verifyCitation("(2099) 1 SCC 1", null);
        assert.ok(sentTo("/api/v1/verify-citations", "(2099) 1 SCC 1"), "signed in: the verify request is sent");
      } finally { clearSession(); }
      // an engine that serves the page itself (no API base): the check is sent
      delete process.env.NEXT_PUBLIC_API_BASE;
      seen.length = 0;
      await verifyCitation("(2099) 1 SCC 1", null);
      assert.ok(sentTo("/api/v1/verify-citations"), "a self-serving engine: sent");
    } finally {
      globalThis.fetch = originalFetch;
      if (prev === undefined) delete process.env.NEXT_PUBLIC_API_BASE; else process.env.NEXT_PUBLIC_API_BASE = prev;
    }
  });
});
