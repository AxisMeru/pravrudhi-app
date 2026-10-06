import { strict as assert } from "node:assert";
import test from "node:test";

// #14: the outage-aware flow. classifyAnalyseError maps every way analyse-facts can fail to its own message;
// "Could not reach" is reserved for a network that truly failed. fetchServiceStatus reads GET /api/v1/status.

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

function mockFetch(handler: (url: string) => Response | Promise<Response>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

const CLOSED = {
  engine_version: "0.5.42",
  service_window: { timezone: "Europe/London", open: "09:00", close: "21:00", enforced: true, open_now: false, next_open_utc: "2026-10-01T08:00:00+00:00" },
  judge: { state: "unknown" as const, checked_at: null },
};

test("fetchServiceStatus returns the parsed status", async () => {
  const { fetchServiceStatus } = await import("./serviceStatus");
  const restore = mockFetch((url) => (url.endsWith("/api/v1/status") ? ok(CLOSED) : ok({ token: "t" })));
  try {
    const s = await fetchServiceStatus();
    assert.equal(s.kind, "ok");
    if (s.kind === "ok") assert.equal(s.status.service_window?.open_now, false);
  } finally { restore(); }
});

test("fetchServiceStatus: a network failure is 'offline', not a throw", async () => {
  const { fetchServiceStatus } = await import("./serviceStatus");
  const restore = mockFetch(() => { throw new Error("network"); });
  try { assert.equal((await fetchServiceStatus()).kind, "offline"); } finally { restore(); }
});

test("fetchServiceStatus: a gateway error that is not JSON is 'offline'", async () => {
  const { fetchServiceStatus } = await import("./serviceStatus");
  const restore = mockFetch(() => new Response("<html>502 Bad Gateway</html>", { status: 502 }));
  try { assert.equal((await fetchServiceStatus()).kind, "offline"); } finally { restore(); }
});

test("fetchServiceStatus: an old engine without /status (404) is 'unknown', never blocks", async () => {
  const { fetchServiceStatus } = await import("./serviceStatus");
  const restore = mockFetch(() => new Response("{}", { status: 404 }));
  try { assert.equal((await fetchServiceStatus()).kind, "unknown"); } finally { restore(); }
});

test("isClosed: only an explicit open_now === false closes the form", async () => {
  const { isClosed } = await import("./serviceStatus");
  assert.equal(isClosed(CLOSED), true);
  assert.equal(isClosed({ ...CLOSED, service_window: null }), false);
  assert.equal(isClosed({ ...CLOSED, service_window: { ...CLOSED.service_window, open_now: true } }), false);
});

test("formatNextOpen names the viewer's timezone and the window", async () => {
  const { formatNextOpen } = await import("./serviceStatus");
  const w = CLOSED.service_window;
  const s = formatNextOpen(w, "Asia/Kolkata", new Date("2026-10-01T12:00:00Z"));
  assert.match(s, /13:30/);
  assert.match(s, /Asia\/Kolkata|IST/);
  assert.match(formatNextOpen(w, "Europe/London", new Date("2026-10-01T12:00:00Z")), /09:00/);
});

test("classifyAnalyseError: each failure has its own message", async () => {
  const { classifyAnalyseError } = await import("./serviceStatus");
  const { ApiError } = await import("./api");
  const t = classifyAnalyseError(new DOMException("aborted", "TimeoutError"));
  const c = classifyAnalyseError(new DOMException("aborted", "AbortError"));
  const r = classifyAnalyseError(new ApiError(429, "/x", { retryAfter: 30 }));
  const u = classifyAnalyseError(new ApiError(401, "/x"));
  const j = classifyAnalyseError(new ApiError(503, "/x", { code: "judge_unavailable" }));
  const w = classifyAnalyseError(new ApiError(503, "/x", { code: "outside_service_window", retryAfter: 3600 }));
  const n = classifyAnalyseError(new TypeError("fetch failed"));
  const kinds = [t, c, r, u, j, w, n].map((x) => x.kind);
  assert.deepEqual(kinds, ["timeout", "cancelled", "rate_limited", "signed_out", "judge_unavailable", "outside_window", "network"]);
  const msgs = [t, r, u, j, w, n].map((x) => x.message);
  assert.equal(new Set(msgs).size, msgs.length, "messages must be distinct");
  for (const x of [t, r, u, j, w]) assert.doesNotMatch(x.message, /could not reach/i);
  assert.match(n.message, /could not reach/i);
  assert.match(r.message, /30/);
});

test("classifyAnalyseError: an unrecognised 5xx is 'server', not 'network'", async () => {
  const { classifyAnalyseError } = await import("./serviceStatus");
  const { ApiError } = await import("./api");
  assert.equal(classifyAnalyseError(new ApiError(500, "/x")).kind, "server");
});

test("fetchServiceStatus: old engine cases stay usable (403, 200 non-JSON, 200 JSON without a window key)", async () => {
  const { fetchServiceStatus } = await import("./serviceStatus");
  for (const make of [
    () => new Response("{}", { status: 403 }),
    () => new Response("<html>app shell</html>", { status: 200 }),
    () => ok({ detail: "not found" }),
  ]) {
    const restore = mockFetch(make);
    try { assert.equal((await fetchServiceStatus()).kind, "unknown"); } finally { restore(); }
  }
});

test("fetchServiceStatus: a 5xx is offline", async () => {
  const { fetchServiceStatus } = await import("./serviceStatus");
  const restore = mockFetch(() => new Response("{}", { status: 503 }));
  try { assert.equal((await fetchServiceStatus()).kind, "offline"); } finally { restore(); }
});

test("classifyAnalyseError: a judges_warming 503 is its own kind, with the retry wait and no 'nothing scored' claim of failure", async () => {
  const { classifyAnalyseError } = await import("./serviceStatus");
  const { ApiError } = await import("./api");
  const w = classifyAnalyseError(new ApiError(503, "/x", { code: "judge_unavailable", reason: "judges_warming", retryAfter: 30 }));
  assert.equal(w.kind, "judges_warming");
  assert.equal(w.retryAfter, 30);
  assert.match(w.message, /warming up/i);
  assert.match(w.message, /30 seconds/);
  assert.match(w.message, /nothing was scored/i);
  const plain = classifyAnalyseError(new ApiError(503, "/x", { code: "judge_unavailable" }));
  assert.equal(plain.kind, "judge_unavailable");
  assert.notEqual(plain.message, w.message);
});

test("classifyAnalyseError: judges_warming without a Retry-After still reads sensibly", async () => {
  const { classifyAnalyseError } = await import("./serviceStatus");
  const { ApiError } = await import("./api");
  const w = classifyAnalyseError(new ApiError(503, "/x", { code: "judge_unavailable", reason: "judges_warming" }));
  assert.equal(w.kind, "judges_warming");
  assert.doesNotMatch(w.message, /undefined|NaN/);
});

test("classifyAnalyseError: a timeout or a plain judge_unavailable says the models may be off, never 'a minute or two'", async () => {
  const { classifyAnalyseError } = await import("./serviceStatus");
  const { ApiError } = await import("./api");
  const t = classifyAnalyseError(new DOMException("aborted", "TimeoutError"));
  const j = classifyAnalyseError(new ApiError(503, "/x", { code: "judge_unavailable" }));
  assert.match(t.message, /switched off/i);
  assert.match(t.message, /nothing was scored/i);
  assert.match(j.message, /not available right now/i);
  assert.match(j.message, /nothing was scored/i);
  for (const x of [t, j]) assert.doesNotMatch(x.message, /minute/i);
});
