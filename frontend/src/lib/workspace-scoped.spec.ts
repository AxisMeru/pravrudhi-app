import { strict as assert } from "node:assert";
import test from "node:test";

// The guard for the default-workspace decision (session-3, 2026-09-12): workspace_root.py refuses a
// non-admin caller's request unless it names `?workspace=`, for every route server.py/runs.py/nyaya.py resolve
// through root_for(). Every one of those routes is called from api.ts, so this file exercises the real
// exported functions (mocking only global fetch, and — the same way auth.spec.ts's completeMagicLink test
// does — a minimal `window` global) rather than re-deriving the route list by hand.
//
// The other half of the guard matters just as much: a *local or desktop* caller has no session at all
// (identity disabled or optional), and root_for() refuses a named workspace with no user even harder than it
// refuses no workspace ("Sign in to open a workspace"). Naming one must depend on a real session existing, not
// merely on the path shape — the negative tests below are the regression guard for that.

function mockFetch(handler: (url: string, init?: RequestInit) => Response): { restore: () => void; calls: string[] } {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, calls };
}

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

// node:test runs with no DOM at all: `typeof window === "undefined"` is true until a test stubs one in, exactly
// the SSR/build-time case api.ts's own webSessionToken() already guards against with the same check.
function withBrowserSession<T>(fn: () => Promise<T>): Promise<T> {
  const globalAsAny = globalThis as unknown as { window?: unknown };
  const original = globalAsAny.window;
  globalAsAny.window = { location: { pathname: "/", origin: "http://localhost" } };
  return (async () => {
    const { setSession, clearSession } = await import("./auth");
    setSession("test-token", { id: "u1", email: "probe@example.com" });
    try {
      return await fn();
    } finally {
      clearSession();
      globalAsAny.window = original;
    }
  })();
}

test("withWorkspace: appends ?workspace=default to a workspace-scoped path, only with a real session", async () => {
  const { withWorkspace } = await import("./api");
  await withBrowserSession(async () => {
    assert.equal(await withWorkspace("/api/objectives"), "/api/objectives?workspace=default");
    assert.equal(await withWorkspace("/api/runs/abc/stop"), "/api/runs/abc/stop?workspace=default");
    assert.equal(await withWorkspace("/api/nyaya/corpus?q=x"), "/api/nyaya/corpus?q=x&workspace=default");
  });
});

test("withWorkspace: leaves a non-workspace-scoped path untouched even with a session", async () => {
  const { withWorkspace } = await import("./api");
  await withBrowserSession(async () => {
    for (const path of ["/api/health", "/api/status", "/api/me", "/api/workspaces", "/api/update", "/api/chat", "/api/memory"]) {
      assert.equal(await withWorkspace(path), path);
    }
  });
});

test("withWorkspace: never appends a workspace with no session — local/desktop use must not regress", async () => {
  const { withWorkspace } = await import("./api");
  // No window stub, no setSession: the module-load state node:test starts in, matching a local/desktop caller
  // (identity disabled or optional) exactly. root_for() refuses a *named* workspace with no user even harder
  // than it refuses none at all, so this path staying bare is what keeps local/desktop use working.
  assert.equal(await withWorkspace("/api/objectives"), "/api/objectives");
  assert.equal(await withWorkspace("/api/runs"), "/api/runs");
});

test("every workspace-scoped exported call leaves with ?workspace=default when signed in, never bare", async () => {
  const api = await import("./api");
  const { restore, calls } = mockFetch(() => ok({ objectives: [], problems: [], hosts: [], vendors: [] }));
  try {
    await withBrowserSession(async () => {
      await api.objectives();
      await api.objective("o1");
      await api.providers();
      await api.messagingStatus();
      await api.runs();
      await api.run("r1");
      await api.models();
      await api.nyayaVendors();
      await api.nyayaCorpus("q");
    });
  } finally {
    restore();
  }
  assert.ok(calls.length > 0, "the mocked functions must have actually called fetch");
  for (const url of calls) {
    assert.match(url, /[?&]workspace=default(&|$)/, `workspace-scoped call left without ?workspace=: ${url}`);
  }
});

test("the same workspace-scoped calls, signed out, leave with no workspace param at all", async () => {
  const api = await import("./api");
  const { restore, calls } = mockFetch(() => ok({ objectives: [], problems: [], hosts: [], vendors: [] }));
  try {
    await api.objectives();
    await api.runs();
    await api.models();
  } finally {
    restore();
  }
  for (const url of calls) {
    assert.doesNotMatch(url, /[?&]workspace=/, `signed-out call carried ?workspace= (breaks local/desktop): ${url}`);
  }
});

test("a non-workspace-scoped exported call never carries ?workspace=, signed in or not", async () => {
  const api = await import("./api");
  const { restore, calls } = mockFetch(() => ok({ ok: true }));
  try {
    await api.health();
    await api.updateStatus();
    await withBrowserSession(async () => {
      await api.health();
      await api.updateStatus();
    });
  } finally {
    restore();
  }
  for (const url of calls) {
    assert.doesNotMatch(url, /[?&]workspace=/, `non-scoped call carried ?workspace=: ${url}`);
  }
});

test("ensureDefaultWorkspace: provisions the 'default' slug exactly once per session", async () => {
  const api = await import("./api");
  let posts = 0;
  const { restore } = mockFetch((url, init) => {
    assert.match(url, /\/api\/workspaces$/);
    assert.equal(init?.method, "POST");
    assert.equal(JSON.parse(String(init?.body)).slug, "default");
    posts += 1;
    return ok({ slug: "default", path: "/tmp/default" });
  });
  try {
    await Promise.all([api.ensureDefaultWorkspace(), api.ensureDefaultWorkspace()]);
    await api.ensureDefaultWorkspace();
  } finally {
    restore();
  }
  assert.equal(posts, 1, "concurrent and repeat calls in the same session must only provision once");
});
