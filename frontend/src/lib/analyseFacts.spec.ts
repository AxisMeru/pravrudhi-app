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
