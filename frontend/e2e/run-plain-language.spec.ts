import { expect, test } from "@playwright/test";

/**
 * ADR-0005: RunHeader/Timeline/CandidatePanel/runs-page rendered raw self-improvement-loop vocabulary
 * (night, candidate, promoted, incumbent, proposer, "boundary") to a BYOK user watching their own run, with
 * no explanation. `product.spec.ts`'s 13-page loop is heading-only and never drives a run to real events, so
 * this defect survived every other pass on this repo -- this file is what closes that specific coverage gap.
 *
 * A finished run's events come from a single GET (`useLiveRun`'s non-running branch reads `detail.recent`
 * directly, no SSE stream involved), so a route intercept on `/api/runs/{id}` alone is enough to drive every
 * event type through the real rendering components -- this is a frontend text-rendering test, not a claim
 * about engine behavior, so a controlled fixture (matching the real `RunEvent`/`RunDetail` shapes in
 * lib/api.ts) is the right tool, per this project's own "test doubles live in tests" rule, rather than
 * orchestrating a real multi-hour search run on a shared, memory-constrained host just to prove string
 * rendering.
 */

const RUN_DETAIL = {
  id: "test-run",
  target: "model",
  night: 3,
  status: "closed",
  started_at: 1_700_000_000,
  finished_at: 1_700_000_600,
  request: { budget_gpu_h: 2 },
  best_delta: 0.1,
  promoted: ["c1"],
  recent: [
    { type: "proposed", raw: 8, accepted: 3, t: 1_700_000_010 },
    { type: "proposed_one", candidate: "c1", t: 1_700_000_020 },
    {
      type: "paired", candidate: "c1", n: 20, incumbent: 0.5, candidate_score: 0.6, delta: 0.1,
      decision: "accept", t: 1_700_000_030,
    },
    { type: "promoted", candidate: "c1", t: 1_700_000_040 },
    { type: "pruned", candidate: "c2", t: 1_700_000_050 },
    { type: "round", round: 1, selected: 2, remaining_gpu_h: 1.2, t: 1_700_000_060 },
    { type: "closed", night: 3, status: "closed", t: 1_700_000_070 },
  ],
};

// Every jargon term ADR-0005 renamed, checked as a whole word so "boundary" does not also flag a legitimate
// future use of "bound" and so on -- exact strings a reader would actually see.
const RETIRED_JARGON = [
  "Night 3", "night 3", "proposer", "incumbent", "boundary", " promoted", "Candidates", "No candidate",
];

test.describe("run progress view uses plain language", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/runs/test-run", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RUN_DETAIL) }));
  });

  test("every event type renders in plain language, not RSI jargon", async ({ page }) => {
    // The run id travels as ?run=<id> against the fixed /runs/view path (see runs/[id]/page.tsx's own
    // comment: a static export cannot pre-render a UUID-shaped dynamic segment).
    await page.goto("/runs/view?run=test-run");

    await expect(page.getByRole("heading", { name: "LoRA · Pass 3" })).toBeVisible();
    await expect(page.getByText("Explored 8 options, kept 3.")).toBeVisible();
    await expect(page.getByText("Attempt c1 proposed.")).toBeVisible();
    await expect(page.getByText(/c1 evaluated over 20 problems.*decision: accept/)).toBeVisible();
    await expect(page.getByText("c1 adopted — this is the new current best.")).toBeVisible();
    await expect(page.getByText("c2 rejected.")).toBeVisible();
    await expect(page.getByText("Round 1: 2 options kept, 1.2 GPU-h remaining.")).toBeVisible();
    await expect(page.getByText("Pass 3 closed.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Attempts", exact: true })).toBeVisible();
    await expect(page.getByText(/current best/).first()).toBeVisible();

    for (const phrase of RETIRED_JARGON) {
      await expect(page.getByText(phrase, { exact: false })).toHaveCount(0);
    }
  });

  test("the run list card also uses plain language", async ({ page }) => {
    await page.route("**/api/runs", (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([RUN_DETAIL]) });
    });

    await page.goto("/runs");

    await expect(page.getByText("pass 3", { exact: false })).toBeVisible();
    await expect(page.getByText("adopted", { exact: false }).first()).toBeVisible();
    for (const phrase of RETIRED_JARGON) {
      await expect(page.getByText(phrase, { exact: false })).toHaveCount(0);
    }
  });
});
