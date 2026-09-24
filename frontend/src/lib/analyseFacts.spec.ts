import { strict as assert } from "node:assert";
import test from "node:test";

// api.analyseFacts: the client for POST /api/v1/analyse-facts (pravrudhi api/partner.py, LEG-PLAN
// P3/L4). Covers the request shape sent over the wire, IS_DEMO gating, and that this route is NEVER
// workspace-scoped (the server route takes no workspace param -- see partner.py's own _session-free
// design, unlike every nyaya.py route).

function mockFetch(handler: (url: string, init?: RequestInit) => Response): { restore: () => void; calls: { url: string; init?: RequestInit }[] } {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, calls };
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

const FAKE_RESULT = {
  run_id: "nyaya-agent-abc123",
  judge: "house",
  score_sha256: "deadbeef",
  facts: [{ id: "F1", text: "toy fact", sha256: "x" }],
  contracts: [
    {
      contract_id: "bns69",
      outcome: "PROOF",
      reason: "all_elements_established",
      elements: [
        {
          element: "induces the woman by deceitful means",
          is_denial: false,
          status: "established",
          claimed: true,
          p_established: 0.97,
          fact_id: "F1",
          quote: "toy",
          start: 0,
          end: 3,
          quote_check: null,
          attempts: 1,
          occurrences: 1,
          offsets_source: "system",
          quote_source: "model",
          error: null,
        },
      ],
      assertions: { "induces the woman by deceitful means": true },
      lean: { verdict: "grounded", denied_claims: [], unlicensed_claims: [], omitted_claims: [] },
      lean_outcome: "PROOF",
      uncertain: [],
      statute_text_mismatch: false,
    },
  ],
  provenance: "agama",
};

test("analyseFacts: sends facts, contract_ids and narrative in the POST body", async () => {
  // postJSON pulls in a legitimate, correctly-unscoped /api/app-token side call (a local-token fetch) --
  // the same reason workspace-scoped.spec.ts excludes nyayaRegistryCheck/nyayaAsk/nyayaAudit (also POST)
  // from its single-call assertions; not a gap specific to this function.
  const { analyseFacts } = await import("./api");
  const { restore, calls } = mockFetch(() => ok(FAKE_RESULT));
  try {
    await analyseFacts(["fact one", "fact two"], ["bns69"], "a narrative");
  } finally {
    restore();
  }
  const call = calls.find((c) => c.url.includes("/api/v1/analyse-facts"));
  assert.ok(call, `expected a call to /api/v1/analyse-facts among: ${calls.map((c) => c.url).join(", ")}`);
  const body = JSON.parse(String(call.init?.body));
  assert.deepEqual(body, { facts: ["fact one", "fact two"], contract_ids: ["bns69"], narrative: "a narrative" });
});

test("analyseFacts: narrative defaults to an empty string when omitted", async () => {
  const { analyseFacts } = await import("./api");
  const { restore, calls } = mockFetch(() => ok(FAKE_RESULT));
  try {
    await analyseFacts(["fact"], ["bns69"]);
  } finally {
    restore();
  }
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.narrative, "");
});

test("analyseFacts: returns the parsed result with quote_source intact per element", async () => {
  const { analyseFacts } = await import("./api");
  const { restore } = mockFetch(() => ok(FAKE_RESULT));
  try {
    const result = await analyseFacts(["fact"], ["bns69"]);
    assert.equal(result.contracts[0].elements[0].quote_source, "model");
    assert.equal(result.contracts[0].outcome, "PROOF");
    assert.ok(!("audit_path" in result), "audit_path must not be present -- server dropped it (L4 fix)");
  } finally {
    restore();
  }
});

test("analyseFacts: never carries ?workspace=, signed in or not (the server route takes no workspace param)", async () => {
  const { analyseFacts } = await import("./api");
  const { restore, calls } = mockFetch(() => ok(FAKE_RESULT));
  try {
    await analyseFacts(["fact"], ["bns69"]);
  } finally {
    restore();
  }
  for (const { url } of calls) {
    assert.doesNotMatch(url, /[?&]workspace=/, `analyse-facts call carried ?workspace=: ${url}`);
  }
});

// Cold-start UX (2026-09-24, operator decision: no warm workers while we build -- first analyse-facts on
// serverless can take ~2.5 minutes, ~24s engine start + ~200s judge cold start). A single transient failure
// during that window -- a 503 while the judge is still coming up, or the request timing out mid-warm-up --
// must not surface as a hard failure the first time; it's retried once before giving up for real.

function analyseFactsCalls(calls: { url: string; init?: RequestInit }[]): { url: string; init?: RequestInit }[] {
  return calls.filter((c) => c.url.includes("/api/v1/analyse-facts"));
}

test("analyseFacts: a 503 (judge still warming up) is retried once and succeeds on the retry", async () => {
  const { analyseFacts } = await import("./api");
  let attempt = 0;
  const { restore, calls } = mockFetch((url) => {
    if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
    attempt += 1;
    return attempt === 1
      ? new Response(JSON.stringify({ detail: "nyaya agent unavailable" }), { status: 503 })
      : ok(FAKE_RESULT);
  });
  try {
    const result = await analyseFacts(["fact"], ["bns69"]);
    assert.equal(result.run_id, FAKE_RESULT.run_id);
  } finally {
    restore();
  }
  assert.equal(analyseFactsCalls(calls).length, 2, "must have retried exactly once");
});

test("analyseFacts: a network error (aborted mid-warm-up) is retried once and succeeds on the retry", async () => {
  const { analyseFacts } = await import("./api");
  let attempt = 0;
  const { restore, calls } = mockFetch((url) => {
    if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
    attempt += 1;
    if (attempt === 1) throw new Error("network error");
    return ok(FAKE_RESULT);
  });
  try {
    const result = await analyseFacts(["fact"], ["bns69"]);
    assert.equal(result.run_id, FAKE_RESULT.run_id);
  } finally {
    restore();
  }
  assert.equal(analyseFactsCalls(calls).length, 2, "must have retried exactly once");
});

test("analyseFacts: two consecutive 503s throw the real status, not a silent third attempt", async () => {
  const { analyseFacts, ApiError } = await import("./api");
  const { restore, calls } = mockFetch((url) => {
    if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
    return new Response(JSON.stringify({ detail: "nyaya agent unavailable" }), { status: 503 });
  });
  try {
    await assert.rejects(() => analyseFacts(["fact"], ["bns69"]), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal((e as InstanceType<typeof ApiError>).status, 503);
      return true;
    });
  } finally {
    restore();
  }
  assert.equal(analyseFactsCalls(calls).length, 2, "exactly one retry, never more");
});

test("analyseFacts: a 400 (bad request) is never retried", async () => {
  const { analyseFacts, ApiError } = await import("./api");
  const { restore, calls } = mockFetch((url) => {
    if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
    return new Response(JSON.stringify({ detail: "bad contract id" }), { status: 400 });
  });
  try {
    await assert.rejects(() => analyseFacts(["fact"], ["bns69"]), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal((e as InstanceType<typeof ApiError>).status, 400);
      return true;
    });
  } finally {
    restore();
  }
  assert.equal(analyseFactsCalls(calls).length, 1, "a real client error must not be retried");
});

test("analyseFacts: its client-side timeout is generous, above RunPod's own 300s ceiling", async () => {
  const { ANALYSE_FACTS_TIMEOUT_MS } = await import("./api");
  assert.ok(
    ANALYSE_FACTS_TIMEOUT_MS > 300_000,
    `timeout (${ANALYSE_FACTS_TIMEOUT_MS}ms) must exceed RunPod LB's own 300s execution ceiling, or a slow ` +
      "cold start gets cut off client-side before the real backend would have answered",
  );
});
