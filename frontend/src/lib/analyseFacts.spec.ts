import { createHash } from "node:crypto";
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
  facts: [{ id: "F1", sha256: "5eb10579990a4f869f10b6dfaabe3c4790ca99cdbc2e8002c77ff4172353eae0" }],
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

test("analyseFacts: a network error is NOT retried (fail fast to a definite message)", async () => {
  const { analyseFacts } = await import("./api");
  const { restore, calls } = mockFetch((url) => {
    if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
    throw new Error("network error");
  });
  try {
    await assert.rejects(() => analyseFacts(["fact"], ["bns69"]));
  } finally { restore(); }
  assert.equal(analyseFactsCalls(calls).length, 1);
});

test("analyseFacts: ApiError carries the body error code and Retry-After", async () => {
  const { analyseFacts, ApiError } = await import("./api");
  const { restore } = mockFetch((url) => {
    if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
    return new Response(JSON.stringify({ error: "outside_service_window" }), { status: 503, headers: { "retry-after": "120" } });
  });
  try {
    await assert.rejects(() => analyseFacts(["fact"], ["bns69"]), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.code, "outside_service_window");
      assert.equal(e.retryAfter, 120);
      return true;
    });
  } finally { restore(); }
});

test("analyseFacts: an outside-window 503 is never retried", async () => {
  const { analyseFacts } = await import("./api");
  const { restore, calls } = mockFetch((url) => {
    if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
    return new Response(JSON.stringify({ error: "outside_service_window" }), { status: 503 });
  });
  try { await assert.rejects(() => analyseFacts(["fact"], ["bns69"])); } finally { restore(); }
  assert.equal(analyseFactsCalls(calls).length, 1);
});

test("analyseFacts: an already-aborted caller signal rejects with AbortError without a second attempt", async () => {
  const { analyseFacts } = await import("./api");
  const ac = new AbortController();
  const { restore, calls } = mockFetch((url, init) => {
    if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    return ok(FAKE_RESULT);
  });
  ac.abort();
  try {
    await assert.rejects(() => analyseFacts(["fact"], ["bns69"], undefined, ac.signal), (e: unknown) => (e as Error).name === "AbortError");
  } finally { restore(); }
  assert.ok(analyseFactsCalls(calls).length <= 1);
});

test("analyseFacts: the coded 503s from the engine (error code + fixed detail) are read from `error`: judges_offline is final, a busy agent is retried once", async () => {
  const { analyseFacts, ApiError } = await import("./api");
  const { classifyAnalyseError } = await import("./serviceStatus");
  const coded = (code: string, detail: string) => new Response(JSON.stringify({ error: code, detail }), { status: 503 });
  // judges_offline: one attempt, the code and the signed message
  {
    const { restore, calls } = mockFetch((url) => (url.includes("/api/v1/analyse-facts") ? coded("judges_offline", "fixed text") : ok({ token: "t" })));
    try {
      await assert.rejects(() => analyseFacts(["fact"], ["bns69"]), (e: unknown) => {
        assert.ok(e instanceof ApiError);
        assert.equal((e as InstanceType<typeof ApiError>).code, "judges_offline");
        assert.match(classifyAnalyseError(e).message, /switched off/i);
        return true;
      });
    } finally {
      restore();
    }
    assert.equal(analyseFactsCalls(calls).length, 1, "a coded refusal is final");
  }
  // agent_at_capacity: retried once, then succeeds
  {
    let attempt = 0;
    const { restore, calls } = mockFetch((url) => {
      if (!url.includes("/api/v1/analyse-facts")) return ok({ token: "t" });
      attempt += 1;
      return attempt === 1 ? coded("agent_at_capacity", "the nyaya agent is at capacity; retry shortly") : ok(FAKE_RESULT);
    });
    try {
      assert.equal((await analyseFacts(["fact"], ["bns69"])).run_id, FAKE_RESULT.run_id);
    } finally {
      restore();
    }
    assert.equal(analyseFactsCalls(calls).length, 2);
  }
});

test("analyseFacts: the engine echoes id and sha256 only; each fact's text is the text this app submitted (the production Screening defect of 9 Oct)", async () => {
  const { analyseFacts } = await import("./api");
  const { restore } = mockFetch(() => ok(FAKE_RESULT));
  try {
    const r = await analyseFacts(["toy fact"], ["bns69"]);
    assert.deepEqual(r.facts, [{ id: "F1", sha256: "5eb10579990a4f869f10b6dfaabe3c4790ca99cdbc2e8002c77ff4172353eae0", text: "toy fact" }]);
  } finally {
    restore();
  }
});

// withFactText pairs echoed and submitted facts BY sha256; whatever cannot be paired gets no text, so no page ever shows a wrong fact beside a citation.
const wireOf = (facts: { id: string; sha256: string }[]) => ({ ...FAKE_RESULT, facts }) as unknown as import("./api").AnalyseFactsWire;
const H = (t: string) => createHash("sha256").update(t).digest("hex");

test("withFactText: an echo in a different order is paired by sha256, not by position", async () => {
  const { withFactText } = await import("./api");
  const r = await withFactText(wireOf([{ id: "F1", sha256: H("second") }, { id: "F2", sha256: H("first") }]), ["first", "second"]);
  assert.deepEqual(r.facts.map((f) => f.text), ["second", "first"]);
});

test("withFactText: the submitted fact is paired by its STRIPPED text, as the engine hashes it", async () => {
  const { withFactText } = await import("./api");
  const r = await withFactText(wireOf([{ id: "F1", sha256: H("padded") }]), ["  padded \n"]);
  assert.equal(r.facts[0].text, "padded");
});

test("withFactText: a sha256 that matches no submitted fact gets an empty text, the others keep theirs", async () => {
  const { withFactText } = await import("./api");
  const r = await withFactText(wireOf([{ id: "F1", sha256: H("one") }, { id: "F2", sha256: "0".repeat(64) }]), ["one", "two"]);
  assert.deepEqual(r.facts.map((f) => f.text), ["one", ""]);
});

test("withFactText: a count mismatch hides every fact's text", async () => {
  const { withFactText } = await import("./api");
  const r = await withFactText(wireOf([{ id: "F1", sha256: H("one") }]), ["one", "two"]);
  assert.deepEqual(r.facts.map((f) => f.text), [""]);
  const none = await withFactText({ ...wireOf([]), facts: undefined } as never, ["one"]);
  assert.deepEqual(none.facts, []);
});

test("withFactText: two identical submitted facts are each used once", async () => {
  const { withFactText } = await import("./api");
  const r = await withFactText(wireOf([{ id: "F1", sha256: H("same") }, { id: "F2", sha256: H("same") }]), ["same", "same"]);
  assert.deepEqual(r.facts.map((f) => f.text), ["same", "same"]);
});
