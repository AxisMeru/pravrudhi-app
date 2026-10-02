import { expect, test } from "@playwright/test";

// #32 / pravrudhi#220: the matter view shows the engine's own `standard` object, unmapped. Runs against a REAL
// local engine with a real local judge ("dev stack (local)", $0), not a mock, so it needs both:
// LOCAL_ENGINE_URL (an engine with pravrudhi#222 or later) and REAL_ENGINE_JUDGE=1 (a judge it can reach).
// Without the judge, analyse-facts returns 503 and there is nothing true to assert, so the test skips.
test.skip(!process.env.REAL_ENGINE_JUDGE, "needs a real local engine with a reachable judge (REAL_ENGINE_JUDGE=1)");

test("the standard line equals what the real engine reported in response.standard", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/matters");
  await page.locator("main").getByRole("heading", { name: "Matters", exact: true }).waitFor();
  const first = page.getByRole("group", { name: "Contracts to check against" }).getByRole("checkbox").first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await first.click({ force: true });
  await page.getByLabel("Facts (one per line)").fill("TOY: the cheque was dishonoured on presentment.");
  await page.getByLabel(/^Narrative/).fill("standard line, real engine");
  const analysed = page.waitForResponse((r) => r.url().includes("/api/v1/analyse-facts"), { timeout: 150_000 });
  await page.getByRole("button", { name: "Analyse" }).click();
  const res = await analysed;
  expect(res.status()).toBe(200);
  const std = (await res.json()).standard;
  expect(std, "engine must send response.standard (pravrudhi#222)").toBeTruthy();
  const label: Record<string, string> = { proved: "proved", prima_facie_disclosed: "prima facie disclosed" };
  const src: Record<string, string> = { default: "default", proceeding_posture: "from proceeding posture", proceeding_type: "from proceeding type" };
  const post = std.source === "proceeding_posture" && std.proceeding_posture ? `: ${std.proceeding_posture}` : "";
  const basis = std.in_judge_prompt === false
    ? "basis stated; not given to the judge"
    : `${src[std.source] ?? `source: ${std.source}`}${post}`;
  await expect(page.getByTestId("standard-line").first()).toHaveText(
    `standard: ${label[std.applied] ?? std.applied} (${basis})`,
    { timeout: 15_000 },
  );
});
